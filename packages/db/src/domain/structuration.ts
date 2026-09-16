import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  AbsorptionStatus,
  Actor,
  ChannelType,
  ContactRole,
  ContactStatus,
  KnowledgeKind,
  MessageDirection,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { contactDisplayName } from "./contacts";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { createTask, taskMetadataSchema, taskProvenanceSchema } from "./tasks";
import {
  getSenderProfile,
  type TriageAccountProjection,
  type TriageMessageProjection,
} from "./triage";

// Domaine STRUCTURATION (M7, tranche 5 — M7.6, M7.18, M7.20) — ce que le
// second appel LIT et ÉCRIT en base autour d'un sujet que le tri vient
// d'ouvrir. Le pipeline (assemblage du contexte, appel, retenue de la
// proposition) vit dans l'application ; ici ne vivent que les lectures et les
// écritures, testées contre la base.
//
// Mêmes règles que le tri (`./triage`) :
//   1. Les PROJECTIONS sont explicites, champ par champ — jamais une entité
//      Prisma. Elles sont le miroir structurel des types du module de contexte.
//   2. Écrire passe par les primitives du domaine (`createTask`), jamais à côté.
//   3. Le journal porte la proposition intégrale (05 §9.1) et chaque tâche
//      porte sa raison et sa provenance (02, Task).
//
// Et une règle propre à la structuration : UN CONTACT VÉRIFIÉ N'EST JAMAIS
// RÉÉCRIT. Relvo complète la fiche qu'il a lui-même créée (statut `auto`) ;
// sur une fiche que l'utilisateur a vérifiée, il ne pose que le rôle si
// aucun n'est écrit — la correction l'emporte toujours (04 §10).

// ─────────────────────────────────────────────────────────────
// La projection — ce que la structuration a le droit de lire
// ─────────────────────────────────────────────────────────────

/** Miroir structurel de `TacheContexte` (application). */
export type StructurationTaskProjection = {
  titre: string;
  type: string;
  /** AAAA-MM-JJ ou null. */
  date: string | null;
  source: "relvo" | "moi";
  terminee: boolean;
  termineeLe: string | null;
};

/** Miroir structurel de `SujetContexte` (application), plus ce que l'écriture doit savoir. */
export type StructurationSubjectProjection = {
  id: string;
  reference: string;
  titre: string;
  domaine: string | null;
  folderId: string | null;
  proposedFolder: string | null;
  etiquettes: string[];
  statut: "ouvert" | "validé" | "fermé";
  priorite: "normal" | "urgent";
  enAttente: boolean;
  /** Relvo a suggéré la clôture et l'utilisateur n'a pas encore tranché (05 §5.5). */
  resolutionSuggeree: boolean;
  ouvertLe: string;
  situation: {
    ouOnEnEst: string | null;
    prochaineEtape: string | null;
    attente: string | null;
    echeance: string | null;
  };
  resume: string | null;
  taches: StructurationTaskProjection[];
  contacts: { nom: string; entreprise: string | null; role: string | null }[];
  messages: (TriageMessageProjection & {
    piecesJointes: { nom: string; etiquette: string | null }[];
  })[];
};

/** Miroir structurel de `ContactContexte` (application), plus le statut — qui décide ce que Relvo a le droit d'écrire. */
export type StructurationContactProjection = {
  id: string;
  statut: ContactStatus;
  nom: string;
  entreprise: string | null;
  role: string | null;
  noteRelvo: string | null;
  domaineHabituel: string | null;
  /** Dérivable des messages ; non calculé pour l'instant. */
  delaiReponseJours: number | null;
  sujetsOuverts: { reference: string; titre: string; enAttente: boolean }[];
  derniersValides: { reference: string; titre: string }[];
  antecedentsTri: { raison: string; nombre: number }[];
};

/** Miroir structurel de `DomaineContexte` (application). */
export type StructurationDomainProjection = {
  id: string;
  nom: string;
  description: string | null;
  instructions: { titre: string; contenu: string }[];
  documents: { nom: string; etiquette: string | null; resume: string | null }[];
};

/** Miroir structurel de `SujetClos` (application) : de quoi fabriquer une fiche de clôture sans appel. */
export type ClosedSubjectProjection = {
  reference: string;
  titre: string;
  domaine: string | null;
  etiquettes: string[];
  ouvertLe: string;
  valideLe: string;
  situationFinale: StructurationSubjectProjection["situation"];
  resume: string | null;
  tachesRealisees: StructurationTaskProjection[];
  tachesEcartees: { titre: string }[];
};

export type PrecedentProjection = {
  reference: string;
  titre: string;
  /** Rempli pour les plus proches seulement : la fiche de clôture se fabrique à partir de là. */
  clos: ClosedSubjectProjection | null;
};

/** La FICHE d'un sujet, telle que les sollicitations la relisent : compte, domaine, sujet, contact. */
export type SubjectSheetProjection = {
  compte: TriageAccountProjection;
  domaine: StructurationDomainProjection | null;
  sujet: StructurationSubjectProjection;
  /** Le premier contact du sujet — celui que le sujet a créé ou reconnu —, sinon null. */
  contact: StructurationContactProjection | null;
};

export type StructurationProjection = SubjectSheetProjection & {
  precedents: PrecedentProjection[];
};

/** Derniers messages du sujet poussés dans sa fiche ; la fiche borne encore. */
export const STRUCTURATION_LAST_MESSAGES = 5;
/** Titres de sujets validés poussés comme précédents (05 §10.1 : tous les titres, seules les fiches des plus proches). */
export const PRECEDENT_TITLES_MAX = 30;
/** Fiches de clôture poussées, classées par proximité de titre. */
export const PRECEDENT_SHEETS_MAX = 3;

const STATUT_LISIBLE: Record<SubjectStatus, "ouvert" | "validé" | "fermé"> = {
  open: "ouvert",
  validated: "validé",
  closed: "fermé",
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
function jour(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function projectTask(t: {
  title: string;
  kind: TaskKind;
  startDate: Date | null;
  sourceActor: Actor;
  status: TaskStatus;
  completedAt: Date | null;
}): StructurationTaskProjection {
  return {
    titre: t.title,
    type: t.kind,
    date: jour(t.startDate),
    source: t.sourceActor === Actor.ai ? "relvo" : "moi",
    terminee: t.status === TaskStatus.done,
    termineeLe: iso(t.completedAt),
  };
}

/**
 * Les mots d'un titre, prêts pour `to_tsquery` : lettres et chiffres seuls,
 * trois caractères au moins, joints par OU — un précédent qui partage un mot
 * fort du titre remonte, sans exiger qu'il les partage tous. Le dictionnaire
 * français de la base fait le reste (racines, mots vides).
 */
export function titleSearchQuery(titre: string): string | null {
  const mots = [
    ...new Set(
      titre
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((m) => m.trim())
        .filter((m) => m.length >= 3),
    ),
  ].slice(0, 12);
  return mots.length ? mots.join(" | ") : null;
}

/**
 * Les précédents d'un sujet (M7.18, 05 §10.1) : les sujets VALIDÉS du même
 * domaine ou partageant une étiquette — tous les titres, plafonnés —, et les
 * fiches de clôture des plus proches par recherche plein texte sur le titre
 * (vecteur `search_vector`, tenu par trigger). Sans domaine ni étiquette, pas
 * de précédent : rien ne relie encore ce sujet aux autres.
 */
export async function findPrecedents(
  db: TenantDb,
  args: {
    accountId: string;
    subjectId: string;
    folderId: string | null;
    labels: readonly string[];
    titre: string;
  },
): Promise<PrecedentProjection[]> {
  const labels = [...args.labels];
  if (!args.folderId && labels.length === 0) return [];

  const memeFamille: Prisma.SubjectWhereInput = {
    id: { not: args.subjectId },
    status: SubjectStatus.validated,
    OR: [
      ...(args.folderId ? [{ folderId: args.folderId }] : []),
      ...(labels.length ? [{ labels: { hasSome: labels } }] : []),
    ],
  };

  const titres = await db.subject.findMany({
    where: memeFamille,
    select: { id: true, reference: true, title: true },
    orderBy: [{ resolvedAt: "desc" }, { reference: "desc" }],
    take: PRECEDENT_TITLES_MAX,
  });
  if (titres.length === 0) return [];

  // Classement par proximité de titre — une requête brute, hors de portée de
  // l'ORM (`search_vector` est une colonne non supportée). Le filtre tenant
  // est posé À LA MAIN : une requête brute ne passe pas par l'extension.
  const requete = titleSearchQuery(args.titre);
  const candidats = titres.map((t) => t.id);
  const proches = requete
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT s."id"
        FROM "subjects" s, to_tsquery('french', ${requete}) q
        WHERE s."account_id" = ${args.accountId}::uuid
          AND s."id" IN (${Prisma.join(candidats.map((id) => Prisma.sql`${id}::uuid`))})
          AND s."search_vector" @@ q
        ORDER BY ts_rank_cd(s."search_vector", q) DESC, s."reference" DESC
        LIMIT ${PRECEDENT_SHEETS_MAX}`
    : [];
  const prochesIds = proches.map((p) => p.id);

  const [clos, taches, ecartees] = prochesIds.length
    ? await Promise.all([
        db.subject.findMany({
          where: { id: { in: prochesIds } },
          select: {
            id: true,
            reference: true,
            title: true,
            summary: true,
            labels: true,
            openedAt: true,
            resolvedAt: true,
            closedAt: true,
            situationWhere: true,
            situationNextStep: true,
            situationWaitingFor: true,
            situationDeadline: true,
            folder: { select: { name: true } },
          },
        }),
        db.task.findMany({
          where: { subjectId: { in: prochesIds }, status: TaskStatus.done },
          select: {
            subjectId: true,
            title: true,
            kind: true,
            startDate: true,
            sourceActor: true,
            status: true,
            completedAt: true,
          },
        }),
        db.eventLog.findMany({
          where: {
            subjectId: { in: prochesIds },
            eventType: EVENT_TYPES.taskDeleted,
          },
          select: { subjectId: true, metadata: true },
        }),
      ])
    : [[], [], []];

  const closById = new Map<string, ClosedSubjectProjection>();
  for (const s of clos) {
    closById.set(s.id, {
      reference: s.reference,
      titre: s.title,
      domaine: s.folder?.name ?? null,
      etiquettes: s.labels,
      ouvertLe: s.openedAt.toISOString(),
      valideLe: (s.resolvedAt ?? s.closedAt ?? s.openedAt).toISOString(),
      situationFinale: {
        ouOnEnEst: s.situationWhere,
        prochaineEtape: s.situationNextStep,
        attente: s.situationWaitingFor,
        echeance: jour(s.situationDeadline),
      },
      resume: s.summary,
      tachesRealisees: taches
        .filter((t) => t.subjectId === s.id)
        .map(projectTask),
      // Les tâches de Relvo que l'utilisateur a supprimées : le journal les
      // conserve telles que proposées (`deleteTask`).
      tachesEcartees: ecartees
        .filter((e) => e.subjectId === s.id)
        .map((e) => {
          const p = (
            e.metadata as { proposal?: Record<string, unknown> } | null
          )?.proposal;
          return p && p.sourceActor === Actor.ai && typeof p.title === "string"
            ? { titre: p.title }
            : null;
        })
        .filter((t): t is { titre: string } => t !== null),
    });
  }

  return titres.map((t) => ({
    reference: t.reference,
    titre: t.title,
    clos: closById.get(t.id) ?? null,
  }));
}

/**
 * Charge tout ce que le profil « structuration » du contexte consomme, depuis
 * la base : la fiche du sujet (`loadSubjectSheet`) et ses précédents.
 */
export async function getStructurationProjection(
  db: TenantDb,
  subjectId: string,
): Promise<StructurationProjection> {
  const sheet = await loadSubjectSheet(db, subjectId);
  const precedents = await findPrecedents(db, {
    accountId: sheet.accountId,
    subjectId: sheet.sujet.id,
    folderId: sheet.sujet.folderId,
    labels: sheet.sujet.etiquettes,
    titre: sheet.sujet.titre,
  });
  return { ...sheet, precedents };
}

/** Un message tel qu'une fiche le pousse au modèle. `include` attendu : `senderContact`, `attachments`. */
export const SHEET_MESSAGE_INCLUDE = {
  senderContact: {
    select: { firstName: true, lastName: true, company: true },
  },
  attachments: { select: { name: true, aiLabel: true } },
} as const;

export type SheetMessageRow = {
  direction: MessageDirection;
  senderName: string | null;
  senderRaw: string | null;
  senderContact: {
    firstName: string | null;
    lastName: string;
    company: string | null;
  } | null;
  receivedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  subjectLine: string | null;
  content: string | null;
  attachments: { name: string; aiLabel: string | null }[];
};

export function projectSheetMessage(
  m: SheetMessageRow,
  interlocuteur: string,
): StructurationSubjectProjection["messages"][number] {
  const sortant = m.direction === MessageDirection.outgoing;
  const nom =
    m.senderName ??
    (m.senderContact ? contactDisplayName(m.senderContact) : null);
  const expediteur = sortant
    ? interlocuteur
    : `${nom ?? ""}${nom && m.senderRaw ? " " : ""}${m.senderRaw ? `<${m.senderRaw}>` : ""}`.trim() ||
      "inconnu";
  return {
    expediteur,
    recuLe: (m.receivedAt ?? m.sentAt ?? m.createdAt).toISOString(),
    objet: m.subjectLine,
    contenu: m.content ?? "",
    sens: sortant ? ("sortant" as const) : ("entrant" as const),
    piecesJointes: m.attachments.map((a) => ({
      nom: a.name,
      etiquette: a.aiLabel,
    })),
  };
}

/**
 * La fiche d'un sujet, depuis la base : le compte avec ses instructions
 * générales et son registre d'étiquettes, le domaine du sujet avec ses
 * instructions et documents lus, la fiche du sujet avec ses derniers messages,
 * la fiche de son contact. Partagée par la structuration et le brouillon ;
 * la relecture la reprendra.
 */
export async function loadSubjectSheet(
  db: TenantDb,
  subjectId: string,
  options: {
    messages?: number;
    /** Ne pousser dans la fiche que les messages ANTÉRIEURS à cet instant — la relecture sépare ainsi la fiche de ce qui vient d'arriver. */
    messagesBefore?: Date;
  } = {},
): Promise<SubjectSheetProjection & { accountId: string }> {
  const subject = assertFound(
    await db.subject.findFirst({
      where: { id: subjectId },
      include: {
        folder: { select: { id: true, name: true, description: true } },
      },
    }),
    "Sujet",
  );

  const account = assertFound(
    await db.account.findUnique({
      where: { id: subject.accountId },
      select: {
        firstName: true,
        lastName: true,
        sectors: true,
        observedPreferences: true,
      },
    }),
    "Compte",
  );

  const [folders, knowledge, labels, mailboxes, contacts, tasks, messages] =
    await Promise.all([
      db.folder.findMany({
        where: { isActive: true },
        select: { name: true, description: true, isDefault: true },
        orderBy: { name: "asc" },
      }),
      // Les connaissances LUES de « Général » et du domaine du sujet (05 §10.2).
      db.knowledgeDocument.findMany({
        where: {
          absorptionStatus: AbsorptionStatus.read,
          folder: subject.folderId
            ? { OR: [{ isDefault: true }, { id: subject.folderId }] }
            : { isDefault: true },
        },
        select: {
          folderId: true,
          kind: true,
          name: true,
          content: true,
          aiLabel: true,
          aiSummary: true,
          folder: { select: { isDefault: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.label.findMany({
        select: { key: true, status: true },
        orderBy: { key: "asc" },
      }),
      db.channel.findMany({
        where: { type: ChannelType.email, isActive: true },
        select: { identifier: true },
        orderBy: { identifier: "asc" },
      }),
      subject.contactIds.length
        ? db.contact.findMany({
            where: { id: { in: subject.contactIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
              role: true,
              relvoNote: true,
              status: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      db.task.findMany({
        where: { subjectId, status: { not: TaskStatus.deleted } },
        select: {
          title: true,
          kind: true,
          startDate: true,
          sourceActor: true,
          status: true,
          completedAt: true,
        },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      }),
      db.message.findMany({
        where: {
          subjectId,
          ...(options.messagesBefore
            ? { createdAt: { lt: options.messagesBefore } }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: options.messages ?? STRUCTURATION_LAST_MESSAGES,
        include: SHEET_MESSAGE_INCLUDE,
      }),
    ]);

  // Le contact du sujet : le premier de la liste, dans l'ordre de la liste —
  // c'est celui que l'ouverture a créé ou reconnu.
  const contactRows = subject.contactIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  const premier = contactRows[0] ?? null;
  const profil = premier
    ? await getSenderProfile(db, {
        conversationId: null,
        contactId: premier.id,
        adresse: premier.email,
        contact: premier,
      })
    : null;

  const instructionsGenerales = knowledge
    .filter((k) => k.folder.isDefault && k.kind === KnowledgeKind.note)
    .map((k) => ({ titre: k.name, contenu: k.content ?? "" }));
  const duDomaine = knowledge.filter(
    (k) => !k.folder.isDefault && k.folderId === subject.folderId,
  );

  const interlocuteur = premier ? contactDisplayName(premier) : "le contact";
  const projectedMessages = [...messages]
    .reverse()
    .map((m) => projectSheetMessage(m, interlocuteur));

  return {
    accountId: subject.accountId,
    compte: {
      dirigeant: `${account.firstName} ${account.lastName}`.trim(),
      entreprise: null,
      messageries: mailboxes.map((c) => c.identifier),
      secteurs: account.sectors,
      domaines: folders.map((f) => ({
        nom: f.name,
        description: f.description,
      })),
      instructionsGenerales,
      // Le registre entier, candidates comprises : une candidate reprise par
      // un second sujet devient active (04 §10) — le modèle doit la voir.
      etiquettes: labels.map((l) => l.key),
      preferencesObservees: account.observedPreferences,
      sujetsOuverts: [],
    },
    domaine: subject.folder
      ? {
          id: subject.folder.id,
          nom: subject.folder.name,
          description: subject.folder.description,
          instructions: duDomaine
            .filter((k) => k.kind === KnowledgeKind.note)
            .map((k) => ({ titre: k.name, contenu: k.content ?? "" })),
          documents: duDomaine
            .filter((k) => k.kind === KnowledgeKind.file)
            .map((k) => ({
              nom: k.name,
              etiquette: k.aiLabel,
              resume: k.aiSummary,
            })),
        }
      : null,
    sujet: {
      id: subject.id,
      reference: subject.reference,
      titre: subject.title,
      domaine: subject.folder?.name ?? null,
      folderId: subject.folderId,
      proposedFolder: subject.proposedFolder,
      etiquettes: subject.labels,
      statut: STATUT_LISIBLE[subject.status],
      priorite: subject.priority,
      enAttente: subject.waitingForReply,
      resolutionSuggeree: subject.resolutionSuggestedAt !== null,
      ouvertLe: subject.openedAt.toISOString(),
      situation: {
        ouOnEnEst: subject.situationWhere,
        prochaineEtape: subject.situationNextStep,
        attente: subject.situationWaitingFor,
        echeance: jour(subject.situationDeadline),
      },
      resume: subject.summary,
      taches: tasks.map(projectTask),
      contacts: contactRows.map((c) => ({
        nom: contactDisplayName(c),
        entreprise: c.company,
        role: c.role,
      })),
      messages: projectedMessages,
    },
    contact:
      premier && profil
        ? {
            id: premier.id,
            statut: premier.status,
            nom: contactDisplayName(premier),
            entreprise: premier.company,
            role: premier.role,
            noteRelvo: premier.relvoNote,
            domaineHabituel: profil.domaineHabituel,
            delaiReponseJours: null,
            sujetsOuverts: profil.sujetsEnCours
              .filter((s) => s.reference !== subject.reference)
              .map((s) => ({
                reference: s.reference,
                titre: s.titre,
                enAttente: s.enAttente,
              })),
            derniersValides: profil.sujetsValidesRecents,
            antecedentsTri: profil.antecedentsTri,
          }
        : null,
  };
}

// ─────────────────────────────────────────────────────────────
// L'écriture — ce que la structuration a le droit d'écrire
// ─────────────────────────────────────────────────────────────

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const heure = z.string().regex(/^\d{2}:\d{2}$/);

export const applyStructurationSchema = z.object({
  subjectId: z.uuid(),
  /** Le message qui a déclenché l'ouverture, rattaché aux tâches et au journal. */
  messageId: z.uuid().optional().nullable(),
  situation: z.object({
    where: z.string().trim().max(500).nullable(),
    nextStep: z.string().trim().max(500).nullable(),
    waitingFor: z.string().trim().max(500).nullable(),
    deadline: dateIso.nullable(),
  }),
  summary: z.string().trim().max(5000).nullable(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        kind: z.enum(TaskKind),
        startDate: dateIso.nullable(),
        startTime: heure.nullable(),
        endDate: dateIso.nullable(),
        endTime: heure.nullable(),
        reason: z.string().trim().max(1000),
        provenance: taskProvenanceSchema.nullable(),
      }),
    )
    .max(10),
  contact: z
    .object({
      firstName: z.string().trim().max(80).nullable(),
      lastName: z.string().trim().max(80).nullable(),
      company: z.string().trim().max(120).nullable(),
      role: z.enum(ContactRole),
    })
    .nullable(),
  /** Clés du registre ; ce qui n'y est pas est écarté ici, une seconde fois. */
  labels: z.array(z.string().trim().min(1).max(60)).max(10),
  proposedFolder: z.string().trim().max(120).nullable(),
  /** La proposition d'origine, intégrale, pour la boucle d'apprentissage (05 §9.1). */
  proposal: z.record(z.string(), z.unknown()).nullable(),
});

export type ApplyStructurationInput = z.input<typeof applyStructurationSchema>;

export type ApplyStructurationResult = {
  taskIds: string[];
  labels: string[];
  /** Ce que Relvo a écrit sur la fiche contact, ou null s'il n'a rien touché. */
  contact: { id: string; fields: string[] } | null;
  proposedFolder: string | null;
};

function utcDate(d: string | null): Date | null {
  return d ? new Date(`${d}T00:00:00.000Z`) : null;
}
function utcTime(d: string | null, t: string | null): Date | null {
  return d && t ? new Date(`${d}T${t}:00.000Z`) : null;
}

/**
 * Applique une structuration à un sujet OUVERT : situation et résumé sur le
 * sujet, tâches créées par la primitive du domaine avec leur raison et leur
 * provenance, contact complété dans les limites de son statut, étiquettes du
 * registre, domaine proposé si le sujet n'en a pas. Une entrée de journal
 * porte la proposition intégrale.
 *
 * Écrit en plusieurs requêtes, pas en une transaction : chaque tâche passe par
 * `createTask` (qui transige), et un échec au milieu laisse un sujet
 * partiellement structuré mais cohérent — le journal dit ce qui a été fait.
 */
export async function applyStructuration(
  db: TenantDb,
  input: ApplyStructurationInput,
): Promise<ApplyStructurationResult> {
  const data = applyStructurationSchema.parse(input);

  const subject = assertFound(
    await db.subject.findFirst({
      where: { id: data.subjectId },
      select: {
        id: true,
        reference: true,
        status: true,
        folderId: true,
        proposedFolder: true,
        contactIds: true,
      },
    }),
    "Sujet",
  );
  if (subject.status !== SubjectStatus.open) {
    throw new DomainError(
      "INVALID_STATE",
      "La structuration ne s'applique qu'à un sujet ouvert.",
    );
  }

  // Étiquettes : celles du registre du compte, et rien d'autre (05 §9.3).
  const registre = await db.label.findMany({ select: { key: true } });
  const cles = new Set(registre.map((l) => l.key));
  const labels = [...new Set(data.labels.filter((k) => cles.has(k)))];

  const proposedFolder =
    !subject.folderId && !subject.proposedFolder && data.proposedFolder
      ? data.proposedFolder
      : null;

  const now = new Date();
  await db.subject.updateMany({
    where: { id: subject.id },
    data: {
      situationWhere: data.situation.where || null,
      situationNextStep: data.situation.nextStep || null,
      situationWaitingFor: data.situation.waitingFor || null,
      situationDeadline: utcDate(data.situation.deadline),
      situationUpdatedAt: now,
      ...(data.summary ? { summary: data.summary } : {}),
      ...(labels.length ? { labels } : {}),
      ...(proposedFolder ? { proposedFolder } : {}),
      lastActivityAt: now,
    },
  });

  const taskIds: string[] = [];
  for (const t of data.tasks) {
    const task = await createTask(db, {
      subjectId: subject.id,
      messageId: data.messageId ?? null,
      title: t.title,
      sourceActor: Actor.ai,
      kind: t.kind,
      startDate: utcDate(t.startDate),
      startTime: utcTime(t.startDate, t.startTime),
      endDate: utcDate(t.endDate),
      endTime: utcTime(t.endDate ?? t.startDate, t.endTime),
      metadata: taskMetadataSchema.parse({
        raison: t.reason,
        provenance: t.provenance,
      }),
    });
    taskIds.push(task.id);
  }

  const contact = data.contact
    ? await completeContactByRelvo(db, subject.contactIds[0] ?? null, {
        firstName: data.contact.firstName,
        lastName: data.contact.lastName,
        company: data.contact.company,
        role: data.contact.role,
      })
    : null;

  await logEvent(db as Tx, {
    entityType: "subject",
    entityId: subject.id,
    subjectId: subject.id,
    messageId: data.messageId ?? null,
    eventType: EVENT_TYPES.subjectStructured,
    title:
      taskIds.length === 0
        ? "Relvo a lu le sujet : rien à faire pour l'instant"
        : `Relvo a structuré le sujet : ${taskIds.length} tâche${taskIds.length > 1 ? "s" : ""}`,
    description: data.situation.where || null,
    actor: Actor.ai,
    metadata: {
      proposal: data.proposal ?? null,
      taskIds,
      labels,
      contact,
      proposedFolder,
    },
  });

  return { taskIds, labels, contact, proposedFolder };
}

/**
 * Ce que Relvo écrit sur une fiche contact, selon son statut (04 §10) :
 *   • `auto` — la fiche est la sienne : identité complétée, rôle posé.
 *   • `complete` — l'utilisateur l'a vérifiée : le rôle seulement, et
 *     seulement s'il est vide. Jamais un nom, jamais une entreprise.
 * Rien n'est écrit sur un sujet sans contact (un groupe, par exemple).
 */
async function completeContactByRelvo(
  db: TenantDb,
  contactId: string | null,
  extrait: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    role: ContactRole;
  },
): Promise<ApplyStructurationResult["contact"]> {
  if (!contactId) return null;
  const contact = await db.contact.findFirst({
    where: { id: contactId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      role: true,
      status: true,
    },
  });
  if (!contact) return null;

  const patch: Prisma.ContactUpdateManyMutationInput = {};
  const fields: string[] = [];
  if (contact.status === ContactStatus.auto) {
    if (extrait.lastName && extrait.lastName !== contact.lastName) {
      patch.lastName = extrait.lastName;
      fields.push("lastName");
    }
    if (extrait.firstName && extrait.firstName !== contact.firstName) {
      patch.firstName = extrait.firstName;
      fields.push("firstName");
    }
    if (extrait.company && extrait.company !== contact.company) {
      patch.company = extrait.company;
      fields.push("company");
    }
    if (extrait.role !== contact.role) {
      patch.role = extrait.role;
      fields.push("role");
    }
  } else if (contact.role === null) {
    patch.role = extrait.role;
    fields.push("role");
  }
  if (fields.length === 0) return null;

  await db.contact.updateMany({ where: { id: contact.id }, data: patch });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: contact.id,
    eventType: EVENT_TYPES.contactUpdated,
    title: `Contact « ${contactDisplayName({
      firstName: (patch.firstName as string | undefined) ?? contact.firstName,
      lastName: (patch.lastName as string | undefined) ?? contact.lastName,
    })} » complété par Relvo`,
    actor: Actor.ai,
    metadata: {
      fields,
      before: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        role: contact.role,
      },
      after: patch,
    },
  });
  return { id: contact.id, fields };
}

/**
 * La structuration a échoué (modèle injoignable, sortie non conforme, erreur
 * en base) : le sujet reste tel que le tri l'a ouvert — titré, classé, sans
 * tâche —, rien n'est inventé (M7.15). Journalisé pour qu'on le voie.
 */
export async function logStructurationFailure(
  db: TenantDb,
  input: { subjectId: string; messageId: string | null; error: string },
) {
  return logEvent(db as Tx, {
    entityType: "subject",
    entityId: input.subjectId,
    subjectId: input.subjectId,
    messageId: input.messageId,
    eventType: EVENT_TYPES.structurationFailed,
    title: "Structuration interrompue — le sujet reste sans tâche",
    description: input.error.slice(0, 500),
    actor: Actor.system,
  });
}
