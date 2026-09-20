import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import {
  type BriefActivity,
  type BriefNews,
  type BriefSuggestion,
  type Kpis,
  countUnsortedConversations,
  enrichSubjects,
  enrichTasks,
  getKpis,
  getOpenFeed,
  getBriefActivity,
  getBriefNews,
  getBriefSuggestions,
  getOverdueTasks,
  getSubjectsAwaitingUser,
  getTaskKpis,
  tenantDb,
} from "@relvo/db";
import {
  type SubjectRowData,
  toSubjectRowData,
} from "@/components/shared/subject-row";
import { type TaskItemData, toTaskItemData } from "@/lib/task-item-data";

// Cache de données serveur (M9.19, point 3) — Vercel Data Cache, durable et
// partagé entre invocations/régions. Coupe les requêtes Neon sur les écrans peu
// volatils : après le 1er remplissage (par compte), les lectures sont servies
// depuis le cache jusqu'à la prochaine mutation (invalidation par tag) ou
// l'expiration (revalidate). C'est le levier du « 1-2 s de premier chargement ».
//
// SÛRETÉ — deux garde-fous :
//  1. On ne met en cache QUE des formes déjà transformées (SubjectRowData,
//     Metric, comptes…), 100 % plates : aucun objet Prisma brut porteur de Date
//     → zéro risque de sérialisation.
//  2. accountId passé en argument → inclus dans la clé de cache (isolation
//     tenant). Invalidation par TENANT_DATA_TAG, purgé par chaque Server Action
//     de mutation (cf. revalidateTenantData). Grossier mais CORRECT : jamais de
//     données périmées après une écriture.
//
// Le revalidate borne la fraîcheur face à un changement EXTERNE (message entrant
// écrit par le worker M6/M7, qui n'invalide pas le cache Next) — à compléter par
// un appel de revalidation depuis le worker quand il sera livré.

export const TENANT_DATA_TAG = "tenant-data";

// Version des clés de cache. À INCRÉMENTER dès qu'une fonction ci-dessous change
// la FORME de son retour : sinon le Vercel Data Cache continue de servir
// l'ancienne forme après déploiement (champ manquant → undefined à l'écran).
// Historique : v2 = Kpis (newSubjects) + Contact (firstName/lastName) + Folder
// (color/icon) ; v3 = SubjectRowData (isNew) ; v4 = SubjectRowData (taskDone/
// taskTotal, − openTaskCount) ; v5 = « Nouveau » dérivé de lastOpenedAt (valeur
// d'isNew/newSubjects recalculée, forme inchangée) ; v6 = Kpis (+ ignoredMessages)
// + KPI tâches + feed tâches + titre de sujet dans l'agenda ; v7 = TaskItemData
// (+ subjectId) + agenda servi en tâches (cachedAgendaTasks) ; v8 = TaskItemData
// (+ folderSlug, rail de couleur par domaine) ; v9 = SubjectStatus à 3 valeurs
// (open/validated/closed) → CachedFeed { ouverts, valides, fermes } ; v10 =
// SubjectRowData (+ folderColor/folderIcon → icône de domaine fidèle au logo) ;
// v11 = TaskItemData (+ relvo : raison et provenance d'une tâche de Relvo) ;
// v12 = TaskItemData (+ replyConversationId : le bouton « Répondre ») ; v13 =
// M18 : brief de l'accueil (nouvelles, activité, suggestions, en attente),
// rendez-vous du Calendrier, CachedFolderRow (+ instructions/documents/
// openSubjects, − sub).
// Suivant = "v14".
const CACHE_V = "v13";

const CACHE = { tags: [TENANT_DATA_TAG], revalidate: 120 };

/**
 * Purge tout le cache de données du tenant. À appeler depuis CHAQUE Server Action
 * de mutation (en plus de revalidatePath) : garantit qu'aucune lecture mise en
 * cache ne reste périmée après une écriture. Volontairement grossier (un seul
 * tag) — la perte d'efficacité est négligeable pour un usage mono-utilisateur.
 *
 * Next 16 : `updateTag` (et non l'ancien `revalidateTag` mono-argument, retiré)
 * invalide le cache taggé avec sémantique read-your-own-writes — à n'appeler que
 * depuis une Server Action, ce qui est le cas de tous nos appelants.
 */
export function revalidateTenantData() {
  updateTag(TENANT_DATA_TAG);
}

/**
 * Invalide le même cache mais depuis un contexte HORS Server Action — le webhook
 * d'ingestion (email/WhatsApp) ou un cron. C'est le maillon qui manquait : un
 * message arrivé par webhook écrit en base mais NE passait par aucune Server
 * Action, donc le Data Cache restait servi jusqu'au `revalidate` (120 s) — et
 * `router.refresh()` (polling) relisait ce cache sans rien voir de neuf. On
 * purge donc le tag ici pour que la prochaine lecture (poll/navigation)
 * recalcule. `updateTag` étant réservé aux Server Actions, on utilise
 * `revalidateTag` en on-demand (2ᵉ argument requis en Next 16 ; le mono-argument
 * est déprécié).
 */
export function expireTenantData() {
  revalidateTag(TENANT_DATA_TAG, "max");
}

// ── KPIs (Accueil) — uniquement des nombres ──────────────────────────────────
export const cachedKpis = unstable_cache(
  (accountId: string): Promise<Kpis> => getKpis(tenantDb(accountId)),
  ["kpis", CACHE_V],
  CACHE,
);

// ── Sujets prioritaires (Accueil) — SubjectRowData[] plat ────────────────────
export const cachedPriorityRows = unstable_cache(
  async (accountId: string): Promise<SubjectRowData[]> => {
    const db = tenantDb(accountId);
    const page = await getOpenFeed(db, { limit: 3 });
    const enriched = await enrichSubjects(db, page.items);
    return enriched.map(toSubjectRowData);
  },
  ["priority-rows", CACHE_V],
  CACHE,
);

// ── Agenda semaine (Accueil) — TÂCHES par jour (TaskItemData plat) ───────────
// Mêmes lignes que partout (TaskItem). weekStartISO/weekEndISO + dayISO dans la
// clé (semaine + « aujourd'hui » pour le marqueur en retard).
export const cachedAgendaTasks = unstable_cache(
  async (
    accountId: string,
    weekStartISO: string,
    weekEndISO: string,
    dayISO: string,
  ): Promise<Record<string, TaskItemData[]>> => {
    const db = tenantDb(accountId);
    const tasks = await db.task.findMany({
      where: {
        status: { not: "deleted" },
        startDate: { gte: new Date(weekStartISO), lt: new Date(weekEndISO) },
      },
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    });
    const enriched = await enrichTasks(db, tasks, new Date(dayISO));
    const byDay: Record<string, TaskItemData[]> = {};
    for (const e of enriched) {
      if (!e.task.startDate) continue;
      const dayKey = e.task.startDate.toISOString().slice(0, 10);
      (byDay[dayKey] ??= []).push(toTaskItemData(e));
    }
    return byDay;
  },
  ["agenda-tasks", CACHE_V],
  CACHE,
);

// ── Tâches (Accueil = plan d'action) ─────────────────────────────────────────
// `dayISO` (jour UTC) entre dans la clé de cache : « aujourd'hui »/« en retard »
// changent au passage de minuit, donc le cache doit se renouveler chaque jour.

export const cachedTaskKpis = unstable_cache(
  (accountId: string, dayISO: string) =>
    getTaskKpis(tenantDb(accountId), new Date(dayISO)),
  ["task-kpis", CACHE_V],
  CACHE,
);

export type CachedTaskFeed = {
  overdue: TaskItemData[];
  /** Les rendez-vous (tâches à l'heure) d'aujourd'hui et des quatorze prochains jours. */
  appointments: TaskItemData[];
};

export const cachedTaskFeed = unstable_cache(
  async (accountId: string, dayISO: string): Promise<CachedTaskFeed> => {
    const db = tenantDb(accountId);
    const now = new Date(dayISO);
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + 14);
    const [overdueTasks, rdvTasks] = await Promise.all([
      getOverdueTasks(db, { now, limit: 50 }),
      db.task.findMany({
        where: {
          status: "open",
          startDate: { gte: now, lt: horizon },
          startTime: { not: null },
        },
        orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
        take: 50,
      }),
    ]);
    const [overdue, appointments] = await Promise.all([
      enrichTasks(db, overdueTasks, now),
      enrichTasks(db, rdvTasks, now),
    ]);
    return {
      overdue: overdue.map(toTaskItemData),
      appointments: appointments.map(toTaskItemData),
    };
  },
  ["task-feed", CACHE_V],
  CACHE,
);

// ── Compteur d'ouverts (en-tête Mon fil) — un nombre ─────────────────────────
export const cachedOpenCount = unstable_cache(
  (accountId: string): Promise<number> =>
    tenantDb(accountId).subject.count({
      where: { status: { notIn: ["validated", "closed"] } },
    }),
  ["open-count", CACHE_V],
  CACHE,
);

// ── Fil (Mon fil) — 3 paniers de SubjectRowData[] + KPI « Sans sujet » ───────
export type CachedFeed = {
  ouverts: SubjectRowData[];
  valides: SubjectRowData[];
  fermes: SubjectRowData[];
  /** Conversations actives dont le dernier message n'a pas de sujet (M6bis). */
  unsortedCount: number;
};

export const cachedFilFeed = unstable_cache(
  async (accountId: string): Promise<CachedFeed> => {
    const db = tenantDb(accountId);
    const [openFeed, validatedSubjects, closedSubjects, unsortedCount] =
      await Promise.all([
        getOpenFeed(db, { limit: 40 }),
        db.subject.findMany({
          where: { status: "validated" },
          orderBy: [{ closedAt: "desc" }],
          take: 40,
        }),
        db.subject.findMany({
          where: { status: "closed" },
          orderBy: [{ closedAt: "desc" }],
          take: 40,
        }),
        countUnsortedConversations(db),
      ]);

    // Un seul enrichSubjects pour les 3 paniers (6 requêtes batchées), redécoupé
    // par longueur (enrichSubjects préserve l'ordre), puis mappé en formes plates.
    const enriched = await enrichSubjects(db, [
      ...openFeed.items,
      ...validatedSubjects,
      ...closedSubjects,
    ]);
    const rows = enriched.map(toSubjectRowData);
    const openLen = openFeed.items.length;
    const validatedLen = validatedSubjects.length;
    return {
      ouverts: rows.slice(0, openLen),
      valides: rows.slice(openLen, openLen + validatedLen),
      fermes: rows.slice(openLen + validatedLen),
      unsortedCount,
    };
  },
  ["fil-feed", CACHE_V],
  CACHE,
);

// ── Mémoire — les domaines en lignes, avec ce qu'ils portent (formes plates) ──
export type CachedFolderRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  instructions: number;
  documents: number;
  openSubjects: number;
};

export type CachedMemoire = {
  /** Le domaine « Général » (transversal) : ses instructions sont celles du compte. */
  defaultFolderId: string | null;
  folders: CachedFolderRow[];
};

export const cachedMemoire = unstable_cache(
  async (accountId: string): Promise<CachedMemoire> => {
    const db = tenantDb(accountId);
    const [folders, subjGroups, docGroups] = await Promise.all([
      db.folder.findMany({
        orderBy: [{ isDefault: "asc" }, { name: "asc" }],
      }),
      db.subject.groupBy({
        by: ["folderId"],
        where: { status: "open" },
        _count: { _all: true },
      }),
      db.knowledgeDocument.groupBy({
        by: ["folderId", "kind"],
        _count: { _all: true },
      }),
    ]);

    const openByFolder = new Map(
      subjGroups.map((g) => [g.folderId, g._count._all]),
    );
    const filesByFolder = new Map<string, number>();
    const notesByFolder = new Map<string, number>();
    for (const g of docGroups) {
      (g.kind === "file" ? filesByFolder : notesByFolder).set(
        g.folderId,
        g._count._all,
      );
    }

    return {
      defaultFolderId: folders.find((f) => f.isDefault)?.id ?? null,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        color: f.color,
        icon: f.icon,
        isDefault: f.isDefault,
        instructions: notesByFolder.get(f.id) ?? 0,
        documents: filesByFolder.get(f.id) ?? 0,
        openSubjects: openByFolder.get(f.id) ?? 0,
      })),
    };
  },
  ["memoire", CACHE_V],
  CACHE,
);

// ── Contacts — déjà plats (select sans Date) ─────────────────────────────────
export type CachedContact = {
  id: string;
  firstName: string | null;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  status: string;
};

export const cachedContacts = unstable_cache(
  (accountId: string): Promise<CachedContact[]> =>
    tenantDb(accountId).contact.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        jobTitle: true,
        status: true,
      },
    }),
  ["contacts", CACHE_V],
  CACHE,
);

export const cachedContactCount = unstable_cache(
  (accountId: string): Promise<number> => tenantDb(accountId).contact.count(),
  ["contact-count", CACHE_V],
  CACHE,
);

// ── Noms de domaines par slug (libellés des chips de filtre Mon fil) ──────────
export const cachedFolderNames = unstable_cache(
  async (accountId: string): Promise<Record<string, string>> => {
    const folders = await tenantDb(accountId).folder.findMany({
      select: { slug: true, name: true },
    });
    return Object.fromEntries(folders.map((f) => [f.slug, f.name]));
  },
  ["folder-names", CACHE_V],
  CACHE,
);

export type FolderChip = {
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
};

// Domaines pour la barre de filtres de Sujets (icône + couleur). Exclut le
// « Général » (documentaire : il ne porte jamais de sujet, cf. invariant n°17).
export const cachedFolders = unstable_cache(
  async (accountId: string): Promise<FolderChip[]> => {
    return tenantDb(accountId).folder.findMany({
      where: { isDefault: false },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, color: true, icon: true },
    });
  },
  ["folders-chips", CACHE_V],
  CACHE,
);

// ── Le brief de l'accueil (M18, invariant 34) — un calcul, jamais une génération ──
// Les nouvelles sont bornées par le dernier passage (`sinceISO` dans la clé) ;
// l'activité et les suggestions par le jour (`dayISO`), comme les tâches.

export type CachedNews = Omit<BriefNews, "since"> & { since: string | null };

export const cachedBriefNews = unstable_cache(
  async (accountId: string, sinceISO: string | null): Promise<CachedNews> => {
    const news = await getBriefNews(
      tenantDb(accountId),
      sinceISO ? new Date(sinceISO) : null,
    );
    return { ...news, since: sinceISO };
  },
  ["brief-news", CACHE_V],
  CACHE,
);

export const cachedBriefActivity = unstable_cache(
  (accountId: string, dayISO: string): Promise<BriefActivity> =>
    getBriefActivity(tenantDb(accountId), new Date(dayISO)),
  ["brief-activity", CACHE_V],
  CACHE,
);

export const cachedBriefSuggestions = unstable_cache(
  (accountId: string, dayISO: string): Promise<BriefSuggestion[]> =>
    getBriefSuggestions(tenantDb(accountId), new Date(dayISO)),
  ["brief-suggestions", CACHE_V],
  CACHE,
);

export type CachedAwaitingSubject = {
  id: string;
  reference: string;
  title: string;
  urgent: boolean;
  awaiting: "reply" | "decision";
  /** « YYYY-MM-DD » ou null. */
  dueDate: string | null;
  /** ISO. */
  since: string;
  contactName: string | null;
};

export const cachedAwaitingSubjects = unstable_cache(
  async (accountId: string): Promise<CachedAwaitingSubject[]> => {
    const rows = await getSubjectsAwaitingUser(tenantDb(accountId), {
      limit: 5,
    });
    return rows.map((r) => ({
      ...r,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      since: r.since.toISOString(),
    }));
  },
  ["brief-awaiting", CACHE_V],
  CACHE,
);
