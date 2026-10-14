// ZoneHeading — l'intitulé d'une zone de page (accueil, calendrier, bilan,
// mémoire), en texte nu sur le fond blanc (design-system/02-composants, « toute
// zone est NOMMÉE, et les en-têtes sont symétriques ») : le titre à gauche, et
// à droite ce qui la qualifie (« 7 derniers jours », « 3 restantes · 1 en
// retard »). Toujours au-dessus d'une carte, jamais d'une ligne nue. Un
// qualificatif qui porte une alerte passe `hintTone="urgent"` sur sa partie
// rouge, via `hint` en ReactNode.

export function ZoneHeading({
  label,
  hint,
}: {
  label: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between px-4 pb-[7px]">
      <h2 className="text-[16px] leading-5 font-medium text-noir">{label}</h2>
      {hint ? (
        <span className="text-[12px] leading-4 font-light text-gris">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
