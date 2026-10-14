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
          className="h-[72px] animate-pulse rounded-(--rayon-carte) bg-white shadow-carte"
        />
      ))}
    </div>
  );
}

/** La carte d'indicateurs (IndicatorTabs) qui chevauche le bas du ciel. */
export function IndicatorTabsSkeleton() {
  return (
    <div className="relative z-3 mx-4 -mt-7.5 h-[102px] animate-pulse rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte" />
  );
}

/** Barre d'onglets (SegTabs) + lignes — pages Mémoire, Contacts. */
export function TabsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <div className="mx-4 mt-3 h-10 animate-pulse rounded-full bg-(--fond-enfonce)" />
      <RowsSkeleton count={rows} />
    </>
  );
}
