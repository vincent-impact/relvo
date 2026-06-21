// Helpers d'affichage (locale FR) — formatage des dates relatives et code
// couleur par Dossier. Concerns UI : restent côté web, hors couche domaine.

/** « à l'instant », « 35 min », « 2 h », « hier », « il y a 3 j », sinon date. */
export function formatRelative(date: Date | null | undefined): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Heure courte « 11:00 », ou null si pas d'heure. */
export function formatTime(time: Date | null | undefined): string | null {
  if (!time) return null;
  return time.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Libellé de date d'une tâche : « aujourd'hui », « demain », sinon « 18 juin ». */
export function formatTaskDate(
  date: Date | null | undefined,
  time?: Date | null,
): string | null {
  if (!date) return null;
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  let label: string;
  if (sameDay(date, now)) label = "aujourd'hui";
  else if (sameDay(date, tomorrow)) label = "demain";
  else
    label = date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const t = formatTime(time);
  return t ? `${label} · ${t}` : label;
}

/** Libellé de jour « Lun 16 » pour l'agenda. */
export function formatDayLabel(date: Date): { weekday: string; day: number } {
  return {
    weekday: date.toLocaleDateString("fr-FR", {
      weekday: "short",
      timeZone: "UTC",
    }),
    day: date.getUTCDate(),
  };
}

// Palette de points/pastilles par Dossier (code couleur du planning + agenda).
// Couleurs « 600 » fixes du mockup. Mapping déterministe par slug, repli sur un
// cycle pour les dossiers inconnus.
const DOT_COLORS = [
  "var(--brand)",
  "var(--amber-600)",
  "var(--purple-600)",
  "var(--green-600)",
  "var(--red-600)",
  "var(--blue-600)",
];

const SLUG_COLOR: Record<string, string> = {
  fournisseurs: "var(--brand)",
  rh: "var(--purple-600)",
  juridique: "var(--red-600)",
  business: "var(--amber-600)",
  production: "var(--green-600)",
  general: "var(--text-tertiary)",
};

export function folderColor(slug: string | null | undefined): string {
  if (!slug) return "var(--text-tertiary)";
  if (SLUG_COLOR[slug]) return SLUG_COLOR[slug];
  let hash = 0;
  for (const ch of slug) hash = (hash + ch.charCodeAt(0)) % DOT_COLORS.length;
  return DOT_COLORS[hash];
}
