import { z } from "zod";
import {
  Actor,
  Priority,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { cancelAction } from "./actions";
import type { Origine } from "./events";
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
import { dateNue, debutDuJourParis } from "./temps";
import type { TriageAccountProjection } from "./triage";

// Domaine ÉCHANGE (M10) — ce que l'échange avec Relvo LIT en base pour parler
// au dirigeant depuis n'importe quelle page (05 §10.1, « l'échange charge le
// brief et la fiche de la page, et tire le reste par outils »). Les écritures
// de l'échange ne vivent pas ici : chaque outil appelle la fonction du domaine
// que l'écran appelle déjà (M10.8) — `createTask`, `updateSubjectStatus`…
//
// Mêmes règles que le tri et la structuration : des projections explicites,
// champ par champ, miroirs des types du module de contexte de l'application.

/** Miroir structurel de `BriefCompte` (application) : les compteurs du jour, pour l'échange seulement. */
export type BriefProjection = {
  sujetsOuverts: number;
  sujetsUrgents: { reference: string; titre: string; enAttente: boolean }[];
  tachesDuJour: number;
  tachesEnRetard: number;
  conversationsATrier: number;
};

export type EchangeProjection = {
  compte: TriageAccountProjection;
  /** Le domaine de l'affaire ouverte, avec ses connaissances lues ; null hors d'une fiche. */
  domaine: StructurationDomainProjection | null;
  brief: BriefProjection;
  /** La fiche de l'affaire ouverte (`/sujets/[id]`), ou null. */
  sujet: (SubjectSheetProjection["sujet"] & { id: string }) | null;
  /** La fiche du contact ouvert (`/contacts/[id]`), ou celui de l'affaire, ou null. */
  contact: StructurationContactProjection | null;
};

/** Sujets urgents poussés dans le brief : des titres, jamais des fiches. */
export const BRIEF_URGENT_MAX = 8;

/**
 * Le brief du compte, calculé par les indicateurs existants — jamais généré
 * (05 §10.1). Le même calcul que l'accueil et la page des affaires.
 */
export async function getBriefProjection(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BriefProjection> {
  const [kpis, urgents, enRetard] = await Promise.all([
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
  ]);
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
  };
}

/**
 * Tout ce que le profil « échange » du contexte consomme, en une lecture :
 * le compte, le brief, et la fiche de la page d'origine — celle d'une affaire
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
 * Résout l'affaire que le dirigeant désigne dans l'échange : par sa référence
 * (« SUB-0142 », « 142 »), sinon par son titre, en cherchant d'abord parmi les
 * affaires ouvertes. Null si rien ne correspond — jamais une approximation
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
  subjectId: string | null;
  affaire: string | null;
  sens: "entrant" | "sortant";
  expediteur: string | null;
  /** ISO 8601. */
  recuLe: string;
  objet: string | null;
  /** Les premiers mots du contenu, bornés. */
  extrait: string;
};

/** Messages rendus au plus par une recherche de l'échange. */
export const SEARCH_MESSAGES_MAX = 20;
const EXTRAIT_MAX = 240;

/**
 * La recherche de messages de l'échange (`search_messages`, 05 §11.6) : une
 * requête bornée sur l'objet, le texte brut et l'expéditeur, mot à mot — pas
 * de recherche vectorielle (invariant 29). Les plus récents d'abord.
 */
export async function searchMessages(
  db: TenantDb,
  args: { recherche: string; limite?: number },
): Promise<MessageTrouve[]> {
  // Chaque mot doit se trouver quelque part — objet, texte ou expéditeur —,
  // pas la phrase entière : « Karim sauce blanche » retrouve le message de
  // Karim qui parle de sauce blanche.
  const mots = args.recherche
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 1);
  if (mots.length === 0) return [];
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_MESSAGES_MAX);
  const rows = await db.message.findMany({
    where: {
      AND: mots.map((mot) => ({
        OR: [
          { subjectLine: { contains: mot, mode: "insensitive" as const } },
          { content: { contains: mot, mode: "insensitive" as const } },
          { senderName: { contains: mot, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      conversationId: true,
      subjectId: true,
      direction: true,
      senderName: true,
      senderRaw: true,
      createdAt: true,
      subjectLine: true,
      content: true,
      conversation: { select: { title: true } },
      subject: { select: { title: true } },
    },
  });
  return rows.map((m) => {
    const texte = (m.content ?? "").replace(/\s+/g, " ").trim();
    return {
      id: m.id,
      conversationId: m.conversationId,
      conversation: m.conversation.title,
      subjectId: m.subjectId,
      affaire: m.subject?.title ?? null,
      sens: m.direction === "outgoing" ? "sortant" : "entrant",
      expediteur: m.senderName ?? m.senderRaw,
      recuLe: m.createdAt.toISOString(),
      objet: m.subjectLine,
      extrait:
        texte.length > EXTRAIT_MAX ? `${texte.slice(0, EXTRAIT_MAX)}…` : texte,
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
 * pas la ressusciter) ; une affaire ouverte dans l'échange se supprime.
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
      return { fait: "Affaire retirée." };
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
