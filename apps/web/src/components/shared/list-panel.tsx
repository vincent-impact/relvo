import { cn } from "@/lib/utils";

// ListPanel — LE panneau qui porte une liste (Direction « Instrument », 2026-09).
//
// Règle de composition : « une liste = UN panneau blanc posé sur la pierre »,
// jamais des lignes nues sur le fond, jamais une carte par ligne (ce qui
// diviserait par deux le nombre d'éléments visibles). Le panneau est de niveau
// 1 (hairline + filet de lumière + ombre ambiante) ; les lignes se séparent par
// un filet `--border-light` et la DERNIÈRE n'en porte pas (sélecteur ci-dessous,
// qui traverse l'enveloppe d'une SwipeRow) — chaque ligne pose `data-list-row`
// sur son élément racine.
//
// `overflow-hidden` rogne les fonds de swipe aux coins du panneau.

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
        "mx-4 overflow-hidden rounded-[14px] border border-(--hairline) bg-white shadow-surface-1",
        "[&>*:last-child_[data-list-row]]:border-b-0 [&>[data-list-row]:last-child]:border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
