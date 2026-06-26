import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import {
  type Kpis,
  countOrphanMessages,
  enrichSubjects,
  getKpis,
  getOpenFeed,
  tenantDb,
} from "@relvo/db";
import type { AgendaEvent } from "@/components/home/agenda-week";
import type { Metric } from "@/components/shared/metrics-card";
import {
  type SubjectRowData,
  toSubjectRowData,
} from "@/components/shared/subject-row";
import { folderColor, formatTime } from "@/lib/display";

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

// ── KPIs (Accueil) — uniquement des nombres ──────────────────────────────────
export const cachedKpis = unstable_cache(
  (accountId: string): Promise<Kpis> => getKpis(tenantDb(accountId)),
  ["kpis"],
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
  ["priority-rows"],
  CACHE,
);

// ── Agenda semaine (Accueil) — évènements par jour, plats ────────────────────
// weekStartISO/weekEndISO dans la clé (la semaine courante change chaque lundi).
export const cachedAgendaEvents = unstable_cache(
  async (
    accountId: string,
    weekStartISO: string,
    weekEndISO: string,
  ): Promise<Record<string, AgendaEvent[]>> => {
    const db = tenantDb(accountId);
    const tasks = await db.task.findMany({
      where: {
        status: { not: "deleted" },
        startDate: { gte: new Date(weekStartISO), lt: new Date(weekEndISO) },
      },
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        title: true,
        startDate: true,
        startTime: true,
        subject: {
          select: {
            id: true,
            reference: true,
            folder: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const eventsByDay: Record<string, AgendaEvent[]> = {};
    for (const t of tasks) {
      if (!t.startDate) continue;
      const dayKey = t.startDate.toISOString().slice(0, 10);
      (eventsByDay[dayKey] ??= []).push({
        id: t.id,
        time: formatTime(t.startTime),
        color: folderColor(t.subject?.folder?.slug),
        title: t.title,
        sublabel: t.subject
          ? `${t.subject.reference}${t.subject.folder ? ` · ${t.subject.folder.name}` : ""}`
          : null,
        href: t.subject ? `/sujets/${t.subject.id}?tab=taches` : "/planning",
      });
    }
    return eventsByDay;
  },
  ["agenda-events"],
  CACHE,
);

// ── Compteur d'ouverts (en-tête Mon fil) — un nombre ─────────────────────────
export const cachedOpenCount = unstable_cache(
  (accountId: string): Promise<number> =>
    tenantDb(accountId).subject.count({
      where: { status: { notIn: ["resolved", "archived", "ignored"] } },
    }),
  ["open-count"],
  CACHE,
);

// ── Fil (Mon fil) — 3 paniers de SubjectRowData[] + compteur d'orphelins ─────
export type CachedFeed = {
  ouverts: SubjectRowData[];
  termines: SubjectRowData[];
  ignores: SubjectRowData[];
  orphanCount: number;
};

export const cachedFilFeed = unstable_cache(
  async (accountId: string): Promise<CachedFeed> => {
    const db = tenantDb(accountId);
    const [openFeed, resolvedSubjects, ignoredSubjects, orphanCount] =
      await Promise.all([
        getOpenFeed(db, { limit: 40 }),
        db.subject.findMany({
          where: { status: "resolved" },
          orderBy: [{ resolvedAt: "desc" }],
          take: 40,
        }),
        db.subject.findMany({
          where: { status: "ignored" },
          orderBy: [{ lastActivityAt: "desc" }],
          take: 40,
        }),
        countOrphanMessages(db),
      ]);

    // Un seul enrichSubjects pour les 3 paniers (6 requêtes batchées), redécoupé
    // par longueur (enrichSubjects préserve l'ordre), puis mappé en formes plates.
    const enriched = await enrichSubjects(db, [
      ...openFeed.items,
      ...resolvedSubjects,
      ...ignoredSubjects,
    ]);
    const rows = enriched.map(toSubjectRowData);
    const openLen = openFeed.items.length;
    const resolvedLen = resolvedSubjects.length;
    return {
      ouverts: rows.slice(0, openLen),
      termines: rows.slice(openLen, openLen + resolvedLen),
      ignores: rows.slice(openLen + resolvedLen),
      orphanCount,
    };
  },
  ["fil-feed"],
  CACHE,
);

// ── Mémoire (Dossiers) — stats + lignes de dossiers (formes plates) ──────────
export type CachedFolderRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  sub: string;
};

export const cachedDossiers = unstable_cache(
  async (
    accountId: string,
  ): Promise<{ metrics: Metric[]; folders: CachedFolderRow[] }> => {
    const db = tenantDb(accountId);
    const [folders, subjectsTotal, subjGroups, docGroups, filesRead] =
      await Promise.all([
        db.folder.findMany({
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        }),
        db.subject.count(),
        db.subject.groupBy({ by: ["folderId"], _count: { _all: true } }),
        db.knowledgeDocument.groupBy({
          by: ["folderId", "kind"],
          _count: { _all: true },
        }),
        db.knowledgeDocument.count({
          where: { kind: "file", absorptionStatus: "read" },
        }),
      ]);

    const subjByFolder = new Map(
      subjGroups.map((g) => [g.folderId, g._count._all]),
    );
    const filesByFolder = new Map<string, number>();
    const notesByFolder = new Map<string, number>();
    let notesTotal = 0;
    let filesTotal = 0;
    for (const g of docGroups) {
      const n = g._count._all;
      if (g.kind === "file") {
        filesByFolder.set(g.folderId, n);
        filesTotal += n;
      } else {
        notesByFolder.set(g.folderId, n);
        notesTotal += n;
      }
    }
    const saturation =
      filesTotal === 0 ? 0 : Math.round((filesRead / filesTotal) * 100);

    const metrics: Metric[] = [
      { value: subjectsTotal, label: "Sujets suivis" },
      { value: notesTotal, label: "Instructions" },
      { value: filesTotal, label: "Documents" },
      { type: "gauge", percent: saturation, label: "Saturation" },
    ];

    const folderRows: CachedFolderRow[] = folders.map((f) => {
      const docs =
        (filesByFolder.get(f.id) ?? 0) + (notesByFolder.get(f.id) ?? 0);
      const docLabel = `${docs} document${docs > 1 ? "s" : ""}`;
      const sub = f.isDefault
        ? `Transversal · ${docLabel}`
        : `${subjByFolder.get(f.id) ?? 0} sujet${(subjByFolder.get(f.id) ?? 0) > 1 ? "s" : ""} · ${docLabel}`;
      return {
        id: f.id,
        name: f.name,
        slug: f.slug,
        color: f.color,
        icon: f.icon,
        sub,
      };
    });

    return { metrics, folders: folderRows };
  },
  ["dossiers"],
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
  ["contacts"],
  CACHE,
);

export const cachedContactCount = unstable_cache(
  (accountId: string): Promise<number> => tenantDb(accountId).contact.count(),
  ["contact-count"],
  CACHE,
);
