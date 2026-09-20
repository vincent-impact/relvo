// ZoneHeading — l'intitulé d'une zone de page (accueil, calendrier, bilan,
// mémoire) : un libellé en capitales à gauche, un complément discret à droite
// (« 7 derniers jours », « 3 restantes · 1 en retard »). Toujours au-dessus
// d'un panneau, jamais d'une ligne nue.

export function ZoneHeading({
  label,
  hint,
}: {
  label: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between px-[18px] pb-1.5">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-(--text-secondary) uppercase">
        {label}
      </span>
      {hint ? (
        <span className="text-[12px] text-(--text-secondary)">{hint}</span>
      ) : null}
    </div>
  );
}
