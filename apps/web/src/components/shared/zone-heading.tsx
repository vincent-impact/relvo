import { cn } from "@/lib/utils";

// ZoneHeading — l'intitulé d'une zone de page (accueil, calendrier, bilan,
// mémoire, fiche d'un sujet), en texte nu sur le fond blanc (design-system/02-composants, « toute
// zone est NOMMÉE, et les en-têtes sont symétriques ») : le titre à gauche, et
// à droite ce qui la qualifie (« 7 derniers jours », « 3 restantes · 1 en
// retard »). Toujours au-dessus d'une carte, jamais d'une ligne nue. Un
// qualificatif qui porte une alerte passe `hintTone="urgent"` sur sa partie
// rouge, via `hint` en ReactNode. `badge` dit qui parle, à côté du titre (la
// pastille Relvo sur le résumé d'une fiche) ; `className` règle la gouttière
// quand la zone vit dans un cadre qui impose déjà la sienne.

export function ZoneHeading({
  label,
  hint,
  badge,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-4 pb-[7px]",
        className,
      )}
    >
      <h2 className="flex min-w-0 items-center gap-2 text-[16px] leading-5 font-medium text-noir">
        {label}
        {badge}
      </h2>
      {/* Graisse normale : sous 14 px, la graisse fine s'efface au soleil (01-tokens). */}
      {hint ? (
        <span className="text-[12px] leading-4 font-normal text-gris">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
