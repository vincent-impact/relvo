// Les icônes PLEINES du dock — Accueil, Calendrier, Sujets, Conversations — telles
// que les planches de la direction « Lettrage d'artisan » les dessinent et que
// le dirigeant les a validées (« en accord avec les icônes des menus »). Elles
// sont les quatre seules icônes pleines du chrome ; partout ailleurs, lucide.
// Un seul trait, une seule graisse : `fill="currentColor"`, 22 px.

type IconProps = { className?: string };

export function HouseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3.2 2.8 11h2.6v9.2h5.2v-6h2.8v6h5.2V11h2.6z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 5.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" />
      <path d="M3 10.5h18" stroke="var(--noir)" strokeWidth="1.8" />
      <path
        d="M7.5 3v4.5M16.5 3v4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SubjectsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2.2h8A1.5 1.5 0 0 1 21 8.7V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z" />
    </svg>
  );
}

export function ConversationsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8a1.5 1.5 0 0 1-1.5 1.5H8l-4 3.5V4.5z" />
      <path d="M19 8h.5A1.5 1.5 0 0 1 21 9.5V21l-3.6-3H11a1.5 1.5 0 0 1-1.5-1.5V16h7A2.5 2.5 0 0 0 19 13.5z" />
    </svg>
  );
}
