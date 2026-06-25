import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { FolderRow } from "@/components/shared/folder-row";
import { MetricsCard } from "@/components/shared/metrics-card";
import {
  MetricsCardSkeleton,
  RowsSkeleton,
} from "@/components/shared/screen-skeletons";
import { SectionLabel } from "@/components/shared/section-label";
import { cachedDossiers } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Mémoire (M9.6, Direction B) — « ce que Relvo sait de votre activité ». Hero
// violet + carte stats à cheval (Sujets suivis / Instructions / Documents /
// Saturation en jauge) + note d'agent + dossiers en lignes (compteurs par
// domaine). Chaque dossier = un domaine de la mémoire (icône cerveau dans la nav).
//
// PERF (M9.19) : hero instantané ; stats + dossiers streamés (<Suspense>) et
// servis depuis le cache serveur (cf. @/server/cached).

async function DossiersBody() {
  const accountId = await requireAccountId();
  const { metrics, folders } = await cachedDossiers(accountId);

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
            sub={f.sub}
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
