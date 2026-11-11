import { z } from "zod";
import {
  AbsorptionStatus,
  Actor,
  ChannelType,
  KnowledgeKind,
  Priority,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import { MessageDirection } from "../generated/prisma/enums";
import { Prisma, type Subject, type Task } from "../generated/prisma/client";
import type { TenantDb } from "../tenant";
import { cancelAction } from "./actions";
import type { Origine } from "./events";
import { deleteFolder, moveFolder } from "./folders";
import { createNote, deleteNote, updateNote } from "./knowledge";
import { getKpis } from "./queries";
import { formatSubjectReference } from "./reference";
import { createTask, deleteTask, reopenTask, updateTask } from "./tasks";
import {
  deleteSubject,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
} from "./subjects";
import {
  loadAccountProjection,
  loadContactProjection,
  loadSubjectSheet,
  type StructurationContactProjection,
  type StructurationDomainProjection,
  type SubjectSheetProjection,
} from "./structuration";
import {
  dateNue,
  debutDuJourParis,
  horodatageParis,
  instantDebutJourParis,
  instantFinJourParis,
  jourParis,
} from "./temps";
import type { TriageAccountProjection } from "./triage";

// Domaine ÉCHANGE (M10) — ce que l'échange avec Relvo LIT en base pour parler
// au dirigeant depuis n'importe quelle page (05 §10.1, « l'échange charge le
// brief et la fiche de la page, et tire le reste par outils »). Les écritures
// de l'échange ne vivent pas ici : chaque outil appelle la fonction du domaine
// que l'écran appelle déjà (M10.8) — `createTask`, `updateSubjectStatus`…
//
// Mêmes règles que le tri et la structuration : des projections explicites,
// champ par champ, miroirs des types du module de contexte de l'application.
//
// LES RECHERCHES DE L'ÉCHANGE PRENNENT LES CRITÈRES QUE LE DIRIGEANT DIT — un
// jour, une personne, un domaine, un canal, un état —, jamais seulement un
// mot-clé (PITFALLS #68) : un outil à filtres figés pousse le modèle à inventer
// un mot (« 2026-10-19 », « email ») et à conclure qu'il n'y a rien. Chaque
// critère RÉDUIT ce qui remonte ; sans critère, les derniers éléments.

/** Miroir structurel de `BriefCompte` (application) : les compteurs du jour, pour l'échange seulement. */
export type BriefProjection = {
  sujetsOuverts: number;
  sujetsUrgents: { reference: string; titre: string; enAttente: boolean }[];
  tachesDuJour: number;
  tachesEnRetard: number;
  conversationsATrier: number;
  /** Messages reçus depuis minuit, heure française. */
  messagesRecusAujourdhui: number;
  /** Messages reçus sur les sept derniers jours. */
  messagesRecus7j: number;
};

export type EchangeProjection = {
  compte: TriageAccountProjection;
  /** Le domaine du sujet ouvert, avec ses connaissances lues ; null hors d'une fiche. */
  domaine: StructurationDomainProjection | null;
  brief: BriefProjection;
  /** La fiche du sujet ouvert (`/sujets/[id]`), ou null. */
  sujet: (SubjectSheetProjection["sujet"] & { id: string }) | null;
  /** La fiche du contact ouvert (`/contacts/[id]`), ou celui du sujet, ou null. */
  contact: StructurationContactProjection | null;
};

/** Sujets urgents poussés dans le brief : des titres, jamais des fiches. */
export const BRIEF_URGENT_MAX = 8;

/**
 * Le brief du compte, calculé par les indicateurs existants — jamais généré
 * (05 §10.1). Le même calcul que l'accueil et la page des sujets.
 */
export async function getBriefProjection(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BriefProjection> {
  const [kpis, urgents, enRetard, recusAujourdhui, recus7j] = await Promise.all(
    [
      getKpis(db, { now }),
      db.subject.findMany({
        where: { status: SubjectStatus.open, priority: Priority.urgent },
        select: { reference: true, title: true, waitingForReply: true },
        orderBy: { lastActivityAt: "desc" },
        take: BRIEF_URGENT_MAX,
      }),
      db.task.count({
        where: {
          status: TaskStatus.open,
          startDate: { lt: debutDuJourParis(now) },
        },
      }),
      // « Reçu aujourd'hui » commence à minuit à Paris (PITFALLS #55), sur
      // l'horodatage de réception — pas sur l'instant d'ingestion.
      db.message.count({
        where: {
          direction: MessageDirection.incoming,
          receivedAt: { gte: instantDebutJourParis(jourParis(now)) },
        },
      }),
      db.message.count({
        where: {
          direction: MessageDirection.incoming,
          receivedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
    ],
  );
  return {
    sujetsOuverts: kpis.openSubjects,
    sujetsUrgents: urgents.map((s) => ({
      reference: s.reference,
      titre: s.title,
      enAttente: s.waitingForReply,
    })),
    tachesDuJour: kpis.tasksToday,
    tachesEnRetard: enRetard,
    conversationsATrier: kpis.unsortedConversations,
    messagesRecusAujourdhui: recusAujourdhui,
    messagesRecus7j: recus7j,
  };
}

/**
 * Tout ce que le profil « échange » du contexte consomme, en une lecture :
 * le compte, le brief, et la fiche de la page d'origine — celle d'un sujet
 * (avec son domaine et son contact) ou celle d'un contact. Une page qui n'est
 * ni l'une ni l'autre ne charge que le compte et le brief.
 */
export async function getEchangeProjection(
  db: TenantDb,
  args: {
    accountId: string;
    subjectId?: string | null;
    contactId?: string | null;
    now?: Date;
  },
): Promise<EchangeProjection> {
  const now = args.now ?? new Date();
  if (args.subjectId) {
    const [sheet, brief] = await Promise.all([
      loadSubjectSheet(db, args.subjectId, { messages: 3 }),
      getBriefProjection(db, now),
    ]);
    return {
      compte: sheet.compte,
      domaine: sheet.domaine,
      brief,
      sujet: sheet.sujet,
      contact: sheet.contact,
    };
  }
  const [{ compte, domaine }, brief, contact] = await Promise.all([
    loadAccountProjection(db, args.accountId, null),
    getBriefProjection(db, now),
    args.contactId
      ? loadContactProjection(db, args.contactId)
      : Promise.resolve(null),
  ]);
  return { compte, domaine, brief, sujet: null, contact };
}

/**
 * Résout le sujet que le dirigeant désigne dans l'échange : par sa référence
 * (« SUB-0142 », « 142 »), sinon par son titre, en cherchant d'abord parmi les
 * sujets ouverts. Null si rien ne correspond — jamais une approximation
 * silencieuse : l'outil le dit, et le modèle demande.
 */
export async function resolveSubject(
  db: TenantDb,
  args: { reference?: string | null; titre?: string | null },
): Promise<{ id: string; reference: string; title: string } | null> {
  const select = { id: true, reference: true, title: true } as const;
  const ref = args.reference?.trim();
  if (ref) {
    const numero = ref.match(/(\d+)\s*$/)?.[1];
    const candidates = numero
      ? [ref.toUpperCase(), formatSubjectReference(Number(numero))]
      : [ref.toUpperCase()];
    const parRef = await db.subject.findFirst({
      where: { reference: { in: [...new Set(candidates)] } },
      select,
    });
    if (parRef) return parRef;
  }
  const titre = args.titre?.trim();
  if (titre) {
    const where = { title: { contains: titre, mode: "insensitive" as const } };
    return (
      (await db.subject.findFirst({
        where: { ...where, status: SubjectStatus.open },
        orderBy: { lastActivityAt: "desc" },
        select,
      })) ??
      (await db.subject.findFirst({
        where,
        orderBy: { lastActivityAt: "desc" },
        select,
      }))
    );
  }
  return null;
}

export type MessageTrouve = {
  id: string;
  conversationId: string;
  /** La conversation, telle que la liste la nomme. */
  conversation: string;
  canal: "email" | "whatsapp";
  subjectId: string | null;
  sujet: string | null;
  sens: "entrant" | "sortant";
  expediteur: string | null;
  /** Heure FRANÇAISE, « AAAA-MM-JJ HH:MM » : c'est ce que le modèle lit et ce qu'il répète (PITFALLS #55). */
  recuLe: string;
  objet: string | null;
  /** Les premiers mots du contenu, bornés. */
  extrait: string;
  /**
   * Les mots demandés que ce message porte — posé seulement quand la recherche
   * avait des mots. Vide : le message remonte par la personne, pas par le texte.
   */
  motsPortes?: string[];
};

/** Messages rendus au plus par une recherche de l'échange. */
export const SEARCH_MESSAGES_MAX = 20;
/** Mots d'une recherche pris en compte, au plus. */
const SEARCH_MESSAGES_MOTS = 12;
const EXTRAIT_MAX = 240;

/**
 * Une PERSONNE que le dirigeant nomme (R19, 05 §11.6) : un contact de
 * l'annuaire, ou quelqu'un qui a écrit sans y être encore — un contact ne naît
 * qu'à l'ouverture d'un sujet, et « le message d'Olivier » doit se retrouver
 * avant. Ses repères sont ses adresses et ses numéros, en minuscules.
 */
export type Personne = {
  contactId: string | null;
  nom: string;
  /** Ce qui la distingue d'un homonyme : son entreprise, sinon son adresse ou son numéro. */
  precision: string | null;
  reperes: string[];
};

/** Candidats rendus au plus quand un nom désigne plusieurs personnes. */
const PERSONNES_MAX = 6;

/** Minuscules, sans accents, espaces réduits — le pendant de `sans_accents(lower(…))` en base. */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Les personnes qu'un nom dit peut désigner, tous canaux confondus : les
 * contacts dont le prénom, le nom ou l'entreprise portent chaque mot (une
 * adresse ou un numéro marche aussi), puis les expéditeurs sans fiche dont le
 * nom d'affichage ou l'adresse les portent. Accents et casse indifférents.
 * Un expéditeur sans fiche qui porte le nom d'un contact trouvé, ou une de ses
 * adresses, EST ce contact ; deux expéditeurs du même nom sont une personne.
 */
export async function trouverPersonnes(
  db: TenantDb,
  args: { accountId: string; nom: string },
): Promise<Personne[]> {
  const mots = normaliser(args.nom)
    .split(" ")
    .filter((m) => m.length > 1);
  if (mots.length === 0) return [];
  const porte = (texte: Prisma.Sql) =>
    Prisma.join(
      mots.map((m) => Prisma.sql`position(${m} in ${texte}) > 0`),
      " AND ",
    );

  // Requêtes brutes (`sans_accents` vit en base) : le filtre tenant est posé À LA MAIN.
  const [fiches, expediteurs] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT c."id"
      FROM "contacts" c
      WHERE c."account_id" = ${args.accountId}::uuid
        AND ${porte(Prisma.sql`"sans_accents"(lower(concat_ws(' ',
              c."first_name", c."last_name", c."company", c."email", c."phone",
              array_to_string(c."additional_emails", ' '),
              array_to_string(c."additional_phones", ' '))))`)}
      ORDER BY c."updated_at" DESC
      LIMIT ${PERSONNES_MAX}`,
    db.$queryRaw<{ repere: string; nom: string | null }[]>`
      SELECT lower(m."sender_raw") AS repere, max(m."sender_name") AS nom
      FROM "messages" m
      WHERE m."account_id" = ${args.accountId}::uuid
        AND m."direction" = 'incoming'
        AND m."sender_contact_id" IS NULL
        AND m."sender_raw" IS NOT NULL
        AND ${porte(Prisma.sql`"sans_accents"(lower(concat_ws(' ', m."sender_name", m."sender_raw")))`)}
      GROUP BY lower(m."sender_raw")
      ORDER BY max(m."created_at") DESC
      LIMIT ${PERSONNES_MAX * 4}`,
  ]);

  const contacts = fiches.length
    ? await db.contact.findMany({
        where: { id: { in: fiches.map((f) => f.id) } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          email: true,
          phone: true,
          additionalEmails: true,
          additionalPhones: true,
        },
      })
    : [];
  const rangFiche = new Map(fiches.map((f, i) => [f.id, i]));
  const personnes: Personne[] = contacts
    .sort((a, b) => (rangFiche.get(a.id) ?? 0) - (rangFiche.get(b.id) ?? 0))
    .map((c) => ({
      contactId: c.id,
      nom: c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName,
      precision: c.company ?? c.email ?? c.phone,
      reperes: [
        ...new Set(
          [c.email, c.phone, ...c.additionalEmails, ...c.additionalPhones]
            .filter((r): r is string => !!r?.trim())
            .map((r) => r.trim().toLowerCase()),
        ),
      ],
    }));

  for (const e of expediteurs) {
    const nom = e.nom?.trim() || e.repere;
    const meme = personnes.find(
      (p) =>
        p.reperes.includes(e.repere) || normaliser(p.nom) === normaliser(nom),
    );
    if (meme) {
      if (!meme.reperes.includes(e.repere)) meme.reperes.push(e.repere);
      continue;
    }
    personnes.push({
      contactId: null,
      nom,
      precision: e.repere === nom ? null : e.repere,
      reperes: [e.repere],
    });
  }
  return personnes.slice(0, PERSONNES_MAX);
}

/**
 * UNE personne, ou ce qui empêche de la choisir : aucune, ou plusieurs — un
 * nom complet qui correspond exactement à une seule tranche. Un homonyme n'est
 * jamais choisi en silence (PITFALLS #68) : le message nomme les candidats.
 */
export async function resoudrePersonne(
  db: TenantDb,
  args: { accountId: string; nom: string },
): Promise<
  | { personne: Personne }
  | { personne: null; candidats: Personne[]; message: string }
> {
  const candidats = await trouverPersonnes(db, args);
  if (candidats.length === 1) return { personne: candidats[0]! };
  const dit = normaliser(args.nom);
  const exacts = candidats.filter((p) => normaliser(p.nom) === dit);
  if (exacts.length === 1) return { personne: exacts[0]! };
  if (candidats.length === 0) {
    return {
      personne: null,
      candidats,
      message: `Personne ne s'appelle « ${args.nom.trim()} » dans l'annuaire ni parmi ceux qui ont écrit.`,
    };
  }
  return {
    personne: null,
    candidats,
    message: `Plusieurs personnes correspondent : ${candidats
      .map((p) => p.nom + (p.precision ? ` (${p.precision})` : ""))
      .join(", ")}. Demander laquelle.`,
  };
}

export type RechercheMessages = {
  accountId: string;
  /** Des mots de l'objet, du texte ou de l'expéditeur ; vide = pas de critère de texte. */
  recherche?: string | null;
  /** Bornes sur l'INSTANT de réception (ou d'envoi) — à calculer en heure française. */
  depuis?: Date | null;
  jusquA?: Date | null;
  /** La personne, déjà résolue (`resoudrePersonne`) : ses messages et ses conversations. */
  personne?: Personne | null;
  sens?: "entrant" | "sortant" | null;
  /** Le canal : e-mail ou WhatsApp. */
  canal?: "email" | "whatsapp" | null;
  /** Les messages d'UN sujet. */
  subjectId?: string | null;
  /** true : seulement les messages reçus non lus. */
  nonLus?: boolean | null;
  limite?: number;
};

/** Les mots d'une recherche, dédoublonnés et bornés. */
function motsDe(recherche: string | null | undefined): string[] {
  return [
    ...new Set(
      (recherche ?? "")
        .trim()
        .split(/\s+/)
        .filter((m) => m.length > 1),
    ),
  ].slice(0, SEARCH_MESSAGES_MOTS);
}

function contient(mot: string) {
  return { contains: mot, mode: "insensitive" as const };
}

/** L'instant d'un message : reçu, sinon envoyé, sinon ingéré. */
function instantDuMessage(m: {
  receivedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}): Date {
  return m.receivedAt ?? m.sentAt ?? m.createdAt;
}

/** Un instant en littéral `timestamp` UTC — les colonnes sont sans fuseau, la comparaison ne doit pas dépendre de celui de la session. */
function horodatageSql(d: Date): Prisma.Sql {
  return Prisma.sql`${d.toISOString().slice(0, 23).replace("T", " ")}::timestamp`;
}

/** Ce qu'un message trouvé rend à l'échange, champ par champ. */
const MESSAGE_TROUVE_SELECT = {
  id: true,
  conversationId: true,
  subjectId: true,
  direction: true,
  senderName: true,
  senderRaw: true,
  createdAt: true,
  receivedAt: true,
  sentAt: true,
  subjectLine: true,
  content: true,
  conversation: { select: { title: true } },
  channel: { select: { type: true } },
  subject: { select: { title: true } },
} satisfies Prisma.MessageSelect;

type MessageLu = Prisma.MessageGetPayload<{
  select: typeof MESSAGE_TROUVE_SELECT;
}>;

function versMessageTrouve(m: MessageLu, extraitMax: number): MessageTrouve {
  const texte = (m.content ?? "").replace(/\s+/g, " ").trim();
  return {
    id: m.id,
    conversationId: m.conversationId,
    conversation: m.conversation.title,
    canal: m.channel.type === ChannelType.whatsapp ? "whatsapp" : "email",
    subjectId: m.subjectId,
    sujet: m.subject?.title ?? null,
    sens: m.direction === "outgoing" ? "sortant" : "entrant",
    expediteur: m.senderName ?? m.senderRaw,
    recuLe: horodatageParis(instantDuMessage(m)),
    objet: m.subjectLine,
    extrait:
      texte.length > extraitMax ? `${texte.slice(0, extraitMax)}…` : texte,
  };
}

/**
 * La recherche de messages de l'échange (`search_messages`, 05 §11.6), dans
 * cet ordre :
 *
 *   1. LA PERSONNE AVANT LE TEXTE — une personne résolue borne la recherche à
 *      ses messages et à ses conversations, tous canaux confondus. C'est un
 *      petit ensemble : ses messages remontent même quand aucun ne porte les
 *      mots, les plus récents d'abord, et `motsPortes` le dit.
 *   2. LE TEXTE, CLASSÉ — plein texte français de la base (vecteur
 *      `search_vector`, tenu par trigger), accents et pluriels indifférents :
 *      un message qui porte un mot demandé remonte, celui qui en porte le plus
 *      sort en premier. Pas de recherche vectorielle (invariant 29).
 *   3. LES FILTRES que le modèle pose sans inventer un mot-clé (PITFALLS #68) :
 *      une plage de jours, un sens, un canal, un sujet, les non-lus.
 *
 * Sans aucun critère, les derniers messages. À égalité de mots, les plus
 * récents d'abord, par instant de réception.
 */
export async function searchMessages(
  db: TenantDb,
  args: RechercheMessages,
): Promise<MessageTrouve[]> {
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_MESSAGES_MAX);

  // Les mots UTILES et leur requête : le dictionnaire écarte les mots vides
  // (« la », « sur »), et chaque mot se cherche tel quel OU sans accents.
  const dits = motsDe(args.recherche);
  const mots = dits.length
    ? await db.$queryRaw<{ mot: string; requete: string }[]>`
        SELECT w AS mot, q::text AS requete
        FROM (
          SELECT w, plainto_tsquery('french', w)
                    || plainto_tsquery('french', "sans_accents"(w)) AS q
          FROM unnest(${dits}::text[]) AS w
        ) s
        WHERE numnode(q) > 0`
    : [];

  const instant = Prisma.sql`coalesce(m."received_at", m."sent_at", m."created_at")`;
  const conditions: Prisma.Sql[] = [
    // Requête brute : le filtre tenant est posé À LA MAIN.
    Prisma.sql`m."account_id" = ${args.accountId}::uuid`,
  ];
  if (args.sens) {
    conditions.push(
      Prisma.sql`m."direction" = ${args.sens === "sortant" ? "outgoing" : "incoming"}::"MessageDirection"`,
    );
  }
  if (args.canal) {
    conditions.push(Prisma.sql`ch."type" = ${args.canal}::"ChannelType"`);
  }
  if (args.subjectId) {
    conditions.push(Prisma.sql`m."subject_id" = ${args.subjectId}::uuid`);
  }
  if (args.nonLus) {
    conditions.push(
      Prisma.sql`m."read_at" IS NULL AND m."direction" = 'incoming'`,
    );
  }
  if (args.depuis) {
    conditions.push(Prisma.sql`${instant} >= ${horodatageSql(args.depuis)}`);
  }
  if (args.jusquA) {
    conditions.push(Prisma.sql`${instant} <= ${horodatageSql(args.jusquA)}`);
  }

  const p = args.personne ?? null;
  if (p) {
    const reperes = Prisma.sql`${p.reperes}::text[]`;
    // Ce qu'elle a écrit : rattaché à sa fiche, ou parti d'un de ses repères.
    const ecritParElle = p.contactId
      ? Prisma.sql`(m."sender_contact_id" = ${p.contactId}::uuid OR lower(m."sender_raw") = ANY(${reperes}))`
      : Prisma.sql`lower(m."sender_raw") = ANY(${reperes})`;
    // Ses conversations : celle dont elle est l'interlocutrice, celles dont
    // elle est destinataire.
    const saConversation = p.contactId
      ? Prisma.sql`(c."contact_id" = ${p.contactId}::uuid
            OR ${p.contactId}::uuid = ANY(c."contact_ids")
            OR lower(c."interlocutor_raw") = ANY(${reperes})
            OR c."participants_raw" && ${reperes})`
      : Prisma.sql`(lower(c."interlocutor_raw") = ANY(${reperes})
            OR c."participants_raw" && ${reperes})`;
    // Dans un fil à plusieurs, « reçu d'elle » ne vaut que pour ce qu'elle a
    // écrit ; dans un fil à deux, tout ce qui est reçu vient d'elle.
    const aDeux = Prisma.sql`(c."type" <> 'whatsapp_group' AND cardinality(c."participants_raw") <= 1)`;
    conditions.push(
      args.sens === "entrant"
        ? Prisma.sql`(${ecritParElle} OR (${saConversation} AND ${aDeux}))`
        : p.contactId
          ? Prisma.sql`(${ecritParElle} OR ${saConversation}
                OR m."recipient_contact_id" = ${p.contactId}::uuid)`
          : Prisma.sql`(${ecritParElle} OR ${saConversation})`,
    );
  }

  const portes = mots.length
    ? Prisma.sql`(${Prisma.join(
        mots.map(
          (m) => Prisma.sql`(m."search_vector" @@ ${m.requete}::tsquery)::int`,
        ),
        " + ",
      )})`
    : Prisma.sql`0::int`;
  const drapeaux = mots.length
    ? Prisma.sql`ARRAY[${Prisma.join(
        mots.map(
          (m) =>
            Prisma.sql`coalesce(m."search_vector" @@ ${m.requete}::tsquery, false)`,
        ),
      )}]`
    : Prisma.sql`ARRAY[]::boolean[]`;
  // Sans personne, le texte FILTRE : un message doit porter au moins un mot
  // (une seule requête en OU — c'est elle que l'index sert). Avec une
  // personne, il ne fait que classer.
  if (mots.length && !p) {
    conditions.push(
      Prisma.sql`m."search_vector" @@ ${mots.map((m) => `(${m.requete})`).join(" | ")}::tsquery`,
    );
  }

  const classes = await db.$queryRaw<{ id: string; drapeaux: boolean[] }[]>`
    SELECT m."id", ${drapeaux} AS drapeaux, ${portes} AS portes
    FROM "messages" m
    JOIN "conversations" c ON c."id" = m."conversation_id"
    JOIN "channels" ch ON ch."id" = m."channel_id"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY portes DESC, ${instant} DESC, m."id" DESC
    LIMIT ${take}`;
  if (classes.length === 0) return [];

  const rows = await db.message.findMany({
    where: { id: { in: classes.map((c) => c.id) } },
    select: MESSAGE_TROUVE_SELECT,
  });
  const parId = new Map(rows.map((r) => [r.id, r]));
  return classes.flatMap((c) => {
    const m = parId.get(c.id);
    if (!m) return [];
    return [
      {
        ...versMessageTrouve(m, EXTRAIT_MAX),
        ...(mots.length
          ? {
              motsPortes: mots
                .filter((_, i) => c.drapeaux[i])
                .map((x) => x.mot),
            }
          : {}),
      },
    ];
  });
}

/** Voisins rendus de chaque côté d'un message lu. */
export const MESSAGE_VOISINS = 3;
const MESSAGE_LU_MAX = 2000;
const VOISIN_MAX = 400;

export type MessageEnContexte = {
  /** Le message, son texte en entier (borné). */
  message: MessageTrouve;
  /** Ses voisins dans la conversation, du plus ancien au plus récent — lui compris, à sa place. */
  fil: (MessageTrouve & { estLeMessage: boolean })[];
};

/**
 * Un message et ses VOISINS dans sa conversation (`get_message`, R19) : de
 * quoi vérifier qu'on tient le bon avant d'en parler ou d'y répondre — un
 * « ok pour demain » ne dit rien sans ce qui le précède. Dans l'ordre du fil
 * tel que la conversation l'affiche.
 */
export async function getMessageEnContexte(
  db: TenantDb,
  id: string,
): Promise<MessageEnContexte | null> {
  const m = await db.message.findFirst({
    where: { id },
    select: MESSAGE_TROUVE_SELECT,
  });
  if (!m) return null;
  const [avant, apres] = await Promise.all([
    db.message.findMany({
      where: {
        conversationId: m.conversationId,
        id: { not: m.id },
        createdAt: { lte: m.createdAt },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MESSAGE_VOISINS,
      select: MESSAGE_TROUVE_SELECT,
    }),
    db.message.findMany({
      where: {
        conversationId: m.conversationId,
        id: { not: m.id },
        createdAt: { gt: m.createdAt },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MESSAGE_VOISINS,
      select: MESSAGE_TROUVE_SELECT,
    }),
  ]);
  const voisin = (v: MessageLu) => ({
    ...versMessageTrouve(v, VOISIN_MAX),
    estLeMessage: false,
  });
  return {
    message: versMessageTrouve(m, MESSAGE_LU_MAX),
    fil: [
      ...avant.reverse().map(voisin),
      { ...versMessageTrouve(m, VOISIN_MAX), estLeMessage: true },
      ...apres.map(voisin),
    ],
  };
}

/**
 * Les messages que Relvo DÉSIGNE (`show_messages`, R19), dans l'ordre où il
 * les nomme : seuls ceux-là se rendent en cartes dans le fil. Un identifiant
 * inconnu du compte est ignoré.
 */
export async function getMessagesDesignes(
  db: TenantDb,
  ids: string[],
): Promise<MessageTrouve[]> {
  const uniques = [...new Set(ids)].slice(0, SEARCH_MESSAGES_MAX);
  if (uniques.length === 0) return [];
  const rows = await db.message.findMany({
    where: { id: { in: uniques } },
    select: MESSAGE_TROUVE_SELECT,
  });
  const parId = new Map(rows.map((r) => [r.id, r]));
  return uniques.flatMap((id) => {
    const m = parId.get(id);
    return m ? [versMessageTrouve(m, EXTRAIT_MAX)] : [];
  });
}

// ─────────────────────────────────────────────────────────────
// Les tâches, les sujets et la Mémoire, par critères (05 §11.6)
// ─────────────────────────────────────────────────────────────

/** Tâches rendues au plus par une recherche de l'échange. */
export const SEARCH_TASKS_MAX = 30;

export type RechercheTaches = {
  /** Des mots du titre ou de la description. */
  recherche?: string | null;
  /**
   * Des jours civils français « AAAA-MM-JJ », bornes incluses : sur
   * l'ÉCHÉANCE (date nue) d'une tâche ouverte, sur l'INSTANT où une tâche
   * faite a été cochée.
   */
  depuis?: string | null;
  jusquAu?: string | null;
  /** true : seulement les tâches sans échéance (flottantes). */
  sansDate?: boolean | null;
  /** true : les ouvertes dont l'échéance est passée, la plus récente d'abord. */
  enRetard?: boolean | null;
  type?: TaskKind | null;
  /** `ouvertes` (défaut) ou `faites`. */
  statut?: "ouvertes" | "faites" | null;
  subjectId?: string | null;
  limite?: number;
};

/**
 * Les tâches de l'échange (`list_tasks`) : une plage de jours que le modèle
 * calcule depuis la date du jour (« lundi », « la semaine prochaine »), les
 * tâches sans date — invisibles à tout filtre sur l'échéance —, un type, des
 * mots, les tâches faites. Les ouvertes se rendent par échéance, les
 * flottantes en dernier ; les faites, la plus récente d'abord.
 */
export async function searchTasks(
  db: TenantDb,
  args: RechercheTaches,
  now: Date = new Date(),
): Promise<Task[]> {
  const faites = args.statut === "faites";
  const take = Math.min(Math.max(args.limite ?? 20, 1), SEARCH_TASKS_MAX);
  const plage: Prisma.TaskWhereInput[] = [];
  if (args.depuis || args.jusquAu) {
    plage.push(
      faites
        ? {
            completedAt: {
              ...(args.depuis
                ? { gte: instantDebutJourParis(args.depuis) }
                : {}),
              ...(args.jusquAu
                ? { lte: instantFinJourParis(args.jusquAu) }
                : {}),
            },
          }
        : {
            startDate: {
              ...(args.depuis ? { gte: dateNue(args.depuis) } : {}),
              ...(args.jusquAu ? { lte: dateNue(args.jusquAu) } : {}),
            },
          },
    );
  }
  const enRetard = !faites && args.enRetard === true;
  const rows = await db.task.findMany({
    where: {
      status: faites ? TaskStatus.done : TaskStatus.open,
      ...(args.subjectId ? { subjectId: args.subjectId } : {}),
      ...(args.type ? { kind: args.type } : {}),
      AND: [
        ...motsDe(args.recherche).map((mot) => ({
          OR: [{ title: contient(mot) }, { description: contient(mot) }],
        })),
        ...plage,
        ...(!faites && args.sansDate ? [{ startDate: null }] : []),
        ...(enRetard ? [{ startDate: { lt: debutDuJourParis(now) } }] : []),
      ],
    },
    orderBy: faites
      ? [{ completedAt: "desc" }]
      : enRetard
        ? [{ startDate: "desc" }, { startTime: "desc" }]
        : [
            { startDate: { sort: "asc", nulls: "last" } },
            { startTime: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
          ],
    take,
  });
  return rows;
}

/** Sujets rendus au plus par une recherche de l'échange. */
export const SEARCH_SUBJECTS_MAX = 20;

export type RechercheAffaires = {
  /** Des mots du titre, du descriptif, du résumé ou de la situation. */
  recherche?: string | null;
  /** `ouvertes` (défaut), `validees`, `fermees`, ou `toutes`. */
  statut?: "ouvertes" | "validees" | "fermees" | "toutes" | null;
  urgentes?: boolean | null;
  /** Celles qui attendent une réponse (marqueur « en attente »). */
  enAttente?: boolean | null;
  folderId?: string | null;
  contactId?: string | null;
  /** Des jours civils français, bornes incluses, sur la DERNIÈRE ACTIVITÉ. */
  depuis?: string | null;
  jusquAu?: string | null;
  limite?: number;
};

/**
 * Les sujets de l'échange (`list_subjects`) : par état, urgence, attente,
 * domaine, contact, mots, et par jours de dernière activité (« ce qui a bougé
 * cette semaine »). Les urgentes d'abord, puis la plus récente activité.
 */
export async function searchSubjects(
  db: TenantDb,
  args: RechercheAffaires,
): Promise<Subject[]> {
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_SUBJECTS_MAX);
  const statut = args.statut ?? "ouvertes";
  const status =
    statut === "validees"
      ? SubjectStatus.validated
      : statut === "fermees"
        ? SubjectStatus.closed
        : statut === "toutes"
          ? undefined
          : SubjectStatus.open;
  return db.subject.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(args.urgentes ? { priority: Priority.urgent } : {}),
      ...(args.enAttente ? { waitingForReply: true } : {}),
      ...(args.folderId ? { folderId: args.folderId } : {}),
      ...(args.contactId ? { contactIds: { has: args.contactId } } : {}),
      ...(args.depuis || args.jusquAu
        ? {
            lastActivityAt: {
              ...(args.depuis
                ? { gte: instantDebutJourParis(args.depuis) }
                : {}),
              ...(args.jusquAu
                ? { lte: instantFinJourParis(args.jusquAu) }
                : {}),
            },
          }
        : {}),
      AND: motsDe(args.recherche).map((mot) => ({
        OR: [
          { title: contient(mot) },
          { description: contient(mot) },
          { summary: contient(mot) },
          { situationWhere: contient(mot) },
        ],
      })),
    },
    orderBy: [{ priority: "desc" }, { lastActivityAt: "desc" }],
    take,
  });
}

/** Connaissances rendues au plus par une recherche de l'échange. */
export const SEARCH_KNOWLEDGE_MAX = 20;
const EXTRAIT_MEMOIRE_MAX = 600;

export type RechercheMemoire = {
  /** Des mots du titre, du contenu, du résumé ou de l'étiquette. */
  recherche?: string | null;
  folderId?: string | null;
  /** `instructions` (les règles du dirigeant), `documents` (ce qu'il a déposé), ou les deux. */
  genre?: "instructions" | "documents" | null;
  limite?: number;
};

export type ConnaissanceTrouvee = {
  id: string;
  genre: "instruction" | "document";
  titre: string;
  domaine: string;
  folderId: string;
  /** false : l'instruction est désactivée, Relvo ne l'applique pas. */
  active: boolean;
  /** Le contenu d'une instruction (borné) ; le résumé de Relvo pour un document. */
  contenu: string | null;
  /** L'étiquette posée par Relvo sur un document, ou null. */
  etiquette: string | null;
};

/**
 * La Mémoire, par mots et par domaine (`search_knowledge`) : ce que le
 * contexte du tour ne porte qu'en partie — ses instructions sont plafonnées
 * et les documents d'un domaine ne s'y lisent que depuis une fiche. Une
 * instruction désactivée est rendue avec son état : le modèle ne l'applique
 * pas, mais il peut dire qu'elle existe.
 */
export async function searchKnowledge(
  db: TenantDb,
  args: RechercheMemoire,
): Promise<ConnaissanceTrouvee[]> {
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_KNOWLEDGE_MAX);
  const rows = await db.knowledgeDocument.findMany({
    where: {
      folder: { is: { isActive: true } },
      ...(args.folderId ? { folderId: args.folderId } : {}),
      ...(args.genre === "instructions"
        ? { kind: KnowledgeKind.note }
        : args.genre === "documents"
          ? { kind: KnowledgeKind.file }
          : {}),
      AND: motsDe(args.recherche).map((mot) => ({
        OR: [
          { name: contient(mot) },
          { content: contient(mot) },
          { description: contient(mot) },
          { aiSummary: contient(mot) },
          { aiLabel: contient(mot) },
        ],
      })),
    },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      kind: true,
      name: true,
      content: true,
      aiSummary: true,
      aiLabel: true,
      absorptionStatus: true,
      folderId: true,
      folder: { select: { name: true } },
    },
  });
  return rows.map((k) => {
    const note = k.kind === KnowledgeKind.note;
    const texte = (note ? k.content : k.aiSummary)?.replace(/\s+/g, " ").trim();
    return {
      id: k.id,
      genre: note ? "instruction" : "document",
      titre: k.name,
      domaine: k.folder.name,
      folderId: k.folderId,
      active: k.absorptionStatus === AbsorptionStatus.read,
      contenu: texte
        ? texte.length > EXTRAIT_MEMOIRE_MAX
          ? `${texte.slice(0, EXTRAIT_MEMOIRE_MAX)}…`
          : texte
        : null,
      etiquette: k.aiLabel,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// L'annulation d'un geste de l'échange (M10.10, 05 §11.6)
// ─────────────────────────────────────────────────────────────

const dateNueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const heureNueSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable();

/** Ce qu'il faut pour recréer ou remettre une tâche telle qu'elle était. */
export const tacheSnapshotSchema = z.object({
  subjectId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).nullable(),
  kind: z.enum(TaskKind),
  startDate: dateNueSchema,
  startTime: heureNueSchema,
  endDate: dateNueSchema,
  endTime: heureNueSchema,
});
export type TacheSnapshot = z.infer<typeof tacheSnapshotSchema>;

const horodatage = z.string().datetime();

/**
 * Le DESCRIPTEUR D'ANNULATION que chaque bloc d'action du fil emporte : ce
 * qu'il faut pour défaire le geste par la même fonction du domaine que
 * l'écran, et l'instant du geste (`a`) — la fenêtre pendant laquelle le
 * bouton reste actif est tenue par l'écran, jamais ici : au-delà, le geste
 * reste réversible par les écrans habituels.
 */
export const annulationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tache"), id: z.uuid(), a: horodatage }),
  z.object({ type: z.literal("tache-cochee"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("tache-modifiee"),
    id: z.uuid(),
    precedent: tacheSnapshotSchema,
    a: horodatage,
  }),
  z.object({
    type: z.literal("tache-supprimee"),
    precedent: tacheSnapshotSchema,
    a: horodatage,
  }),
  z.object({ type: z.literal("affaire"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("statut"),
    id: z.uuid(),
    precedent: z.enum(SubjectStatus),
    a: horodatage,
  }),
  z.object({
    type: z.literal("priorite"),
    id: z.uuid(),
    precedent: z.enum(Priority),
    a: horodatage,
  }),
  z.object({
    type: z.literal("resume"),
    id: z.uuid(),
    precedent: z.string().nullable(),
    a: horodatage,
  }),
  z.object({ type: z.literal("brouillon"), actionId: z.uuid(), a: horodatage }),
  z.object({ type: z.literal("note"), id: z.uuid(), a: horodatage }),
  // Les dossiers (M23.7) : un dossier créé se retire, un dossier déplacé
  // revient sous son père, un sujet rangé retrouve son dossier.
  z.object({ type: z.literal("dossier"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("dossier-deplace"),
    id: z.uuid(),
    precedent: z.uuid().nullable(),
    a: horodatage,
  }),
  z.object({
    type: z.literal("affaire-rangee"),
    id: z.uuid(),
    precedent: z.uuid().nullable(),
    a: horodatage,
  }),
  z.object({
    type: z.literal("note-modifiee"),
    id: z.uuid(),
    precedent: z.object({ name: z.string(), content: z.string().nullable() }),
    a: horodatage,
  }),
  z.object({
    type: z.literal("note-supprimee"),
    precedent: z.object({
      folderId: z.uuid(),
      name: z.string(),
      content: z.string().nullable(),
    }),
    a: horodatage,
  }),
]);
export type Annulation = z.infer<typeof annulationSchema>;

const CHAT: Origine = { source: "chat" };

function datesDuSnapshot(s: TacheSnapshot) {
  const heure = (d: string | null, h: string | null) =>
    d && h ? new Date(`${d}T${h}:00.000Z`) : null;
  return {
    startDate: s.startDate ? dateNue(s.startDate) : null,
    startTime: heure(s.startDate, s.startTime),
    endDate: s.endDate ? dateNue(s.endDate) : null,
    endTime: heure(s.endDate ?? s.startDate, s.endTime),
  };
}

/**
 * DÉFAIT un geste de l'échange, par la fonction du domaine que l'écran
 * appelle pour le même geste — journalisée avec la provenance `chat`. Une
 * tâche supprimée se recrée depuis son instantané (l'écran non plus ne sait
 * pas la ressusciter) ; un sujet ouvert dans l'échange se supprime.
 */
export async function defaireGeste(
  db: TenantDb,
  input: Annulation,
): Promise<{ fait: string }> {
  const g = annulationSchema.parse(input);
  switch (g.type) {
    case "tache":
      await deleteTask(db, g.id, CHAT);
      return { fait: "Tâche retirée." };
    case "tache-cochee":
      await reopenTask(db, g.id, CHAT);
      return { fait: "Tâche remise à faire." };
    case "tache-modifiee":
      await updateTask(
        db,
        g.id,
        {
          title: g.precedent.title,
          description: g.precedent.description,
          kind: g.precedent.kind,
          ...datesDuSnapshot(g.precedent),
        },
        CHAT,
      );
      return { fait: "Tâche remise comme avant." };
    case "tache-supprimee":
      await createTask(
        db,
        {
          subjectId: g.precedent.subjectId,
          title: g.precedent.title,
          description: g.precedent.description,
          kind: g.precedent.kind,
          sourceActor: Actor.user,
          ...datesDuSnapshot(g.precedent),
        },
        CHAT,
      );
      return { fait: "Tâche recréée." };
    case "affaire":
      await deleteSubject(db, g.id);
      return { fait: "Sujet retiré." };
    case "statut":
      await updateSubjectStatus(db, g.id, g.precedent, Actor.user, CHAT);
      return { fait: "État remis comme avant." };
    case "priorite":
      await updateSubjectPriority(db, g.id, g.precedent, Actor.user, CHAT);
      return { fait: "Priorité remise comme avant." };
    case "resume":
      await updateSubject(db, g.id, { summary: g.precedent }, CHAT);
      return { fait: "Résumé remis comme avant." };
    case "brouillon":
      await cancelAction(db, g.actionId, CHAT);
      return { fait: "Brouillon effacé." };
    case "note":
      await deleteNote(db, g.id, CHAT);
      return { fait: "Instruction retirée." };
    case "dossier":
      await deleteFolder(db, g.id);
      return { fait: "Dossier retiré." };
    case "dossier-deplace":
      await moveFolder(db, g.id, g.precedent, CHAT);
      return { fait: "Dossier remis à sa place." };
    case "affaire-rangee":
      await updateSubject(db, g.id, { folderId: g.precedent }, CHAT);
      return { fait: "Sujet remis dans son dossier." };
    case "note-modifiee":
      await updateNote(
        db,
        g.id,
        { name: g.precedent.name, content: g.precedent.content },
        CHAT,
      );
      return { fait: "Instruction remise comme avant." };
    case "note-supprimee":
      await createNote(
        db,
        {
          folderId: g.precedent.folderId,
          name: g.precedent.name,
          content: g.precedent.content,
        },
        CHAT,
      );
      return { fait: "Instruction recréée." };
  }
}
