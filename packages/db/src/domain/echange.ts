import { Priority, SubjectStatus, TaskStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { getKpis } from "./queries";
import { formatSubjectReference } from "./reference";
import {
  loadAccountProjection,
  loadContactProjection,
  loadSubjectSheet,
  type StructurationContactProjection,
  type StructurationDomainProjection,
  type SubjectSheetProjection,
} from "./structuration";
import { debutDuJourParis } from "./temps";
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
