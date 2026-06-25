import { cn } from "@/lib/utils";

// Squelettes de chargement partagés (M9.19, point 2). Affichés dans les frontières
// <Suspense> des pages pendant que leur zone de données stream — le hero violet,
// lui, est déjà rendu (instantané). Dimensions approchées des vraies surfaces.

/** Liste de lignes (sujets, contacts, dossiers, messages). */
export function RowsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 px-4 pt-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-2xl bg-white"
          style={{ boxShadow: "var(--shadow-card)" }}
        />
      ))}
    </div>
  );
}

/** Carte métriques « à cheval » sur le hero (Accueil, Mémoire). */
export function MetricsCardSkeleton() {
  return (
    <div
      className="relative z-[3] mx-4 -mt-[30px] h-[90px] animate-pulse rounded-[22px] bg-white"
      style={{ boxShadow: "var(--shadow-metrics)" }}
    />
  );
}

/** Barre d'onglets (SegTabs) + lignes — pages Mémoire/dossier, Contacts, Réglages. */
export function TabsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <div className="mx-4 mt-3 h-10 animate-pulse rounded-full bg-(--surface)" />
      <RowsSkeleton count={rows} />
    </>
  );
}
