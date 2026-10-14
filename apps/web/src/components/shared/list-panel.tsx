import { cn } from "@/lib/utils";

// ListPanel — LA carte qui porte une liste (design-system/02-composants, « une
// entité de liste est une LIGNE dans UNE carte, pas une carte par ligne »).
//
// Les lignes se séparent par un filet et la DERNIÈRE n'en porte pas (sélecteur
// ci-dessous, qui traverse l'enveloppe d'une SwipeRow) — chaque ligne pose
// `data-list-row` sur son élément racine. `overflow-hidden` rogne les fonds de
// swipe et les bandes de domaine aux coins de la carte.

export function ListPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-4 overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte",
        "[&>*:last-child_[data-list-row]]:border-b-0 [&>[data-list-row]:last-child]:border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
