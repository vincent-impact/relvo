import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { FolderRow } from "@/components/shared/folder-row";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import {
  MetricsCardSkeleton,
  RowsSkeleton,
} from "@/components/shared/screen-skeletons";
import { SectionLabel } from "@/components/shared/section-label";
import { getTenantDb } from "@/server/auth-context";

// Mémoire (M9.6, Direction B) — « ce que Relvo sait de votre activité ». Hero
// violet + carte stats à cheval (Sujets suivis / Instructions / Documents /
// Saturation en jauge) + note d'agent + dossiers en lignes (compteurs par
// domaine). Chaque dossier = un domaine de la mémoire (icône cerveau dans la nav).
//
// PERF (M9.19, point 2) : le hero s'affiche instantanément ; stats + dossiers
// streament dans une frontière <Suspense>.

async function DossiersBody() {
  const db = await getTenantDb();

  const [folders, subjectsTotal, subjGroups, docGroups] = await Promise.all([
    db.folder.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.subject.count(),
    db.subject.groupBy({ by: ["folderId"], _count: { _all: true } }),
    db.knowledgeDocument.groupBy({
      by: ["folderId", "kind"],
      _count: { _all: true },
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

  // Saturation = part des documents absorbés (✦ lus) — proxy d'« encombrement »
  // de la mémoire. Sans documents, 0 %.
  const filesRead = await db.knowledgeDocument.count({
    where: { kind: "file", absorptionStatus: "read" },
  });
  const saturation =
    filesTotal === 0 ? 0 : Math.round((filesRead / filesTotal) * 100);

  const metrics: Metric[] = [
    { value: subjectsTotal, label: "Sujets suivis" },
    { value: notesTotal, label: "Instructions" },
    { value: filesTotal, label: "Documents" },
    { type: "gauge", percent: saturation, label: "Saturation" },
  ];

  function sub(folderId: string, isDefault: boolean) {
    const docs =
      (filesByFolder.get(folderId) ?? 0) + (notesByFolder.get(folderId) ?? 0);
    const docLabel = `${docs} document${docs > 1 ? "s" : ""}`;
    if (isDefault) return `Transversal · ${docLabel}`;
    const subjects = subjByFolder.get(folderId) ?? 0;
    return `${subjects} sujet${subjects > 1 ? "s" : ""} · ${docLabel}`;
  }

  return (
    <>
      <MetricsCard metrics={metrics} />

      <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-2xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3">
        <Sparkles
          className="size-4 flex-none text-relvo"
          fill="currentColor"
          strokeWidth={0}
        />
        <p className="flex-1 text-[13.5px] leading-[1.4] text-[#3a3550]">
          C’est ici que vous enrichissez la mémoire de Relvo et affinez son
          comportement.
        </p>
      </div>

      <SectionLabel title="Dossiers" />
      <div className="pt-1">
        {folders.map((f) => (
          <FolderRow
            key={f.id}
            name={f.name}
            slug={f.slug}
            sub={sub(f.id, f.isDefault)}
            href={`/dossiers/${f.id}`}
          />
        ))}
      </div>
    </>
  );
}

export default function DossiersPage() {
  return (
    <Screen>
      <RelvoHeader
        title="Mémoire"
        subtitle="Ce que Relvo sait de votre activité"
        className="pb-[42px]"
      />
      <Suspense
        fallback={
          <>
            <MetricsCardSkeleton />
            <RowsSkeleton count={5} className="pt-8" />
          </>
        }
      >
        <DossiersBody />
      </Suspense>
    </Screen>
  );
}
