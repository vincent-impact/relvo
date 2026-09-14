// Couche INSTANT (`05 §10.1`) : date, jour, semaine, jours fériés proches.
// Ce qui permet de lire « jeudi », « avant lundi », « après le pont ».

const JOURS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function paques(annee: number): Date {
  // Algorithme de Meeus/Jones/Butcher (grégorien).
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function plusJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Jours fériés français (métropole) d'une année : [date UTC, libellé]. */
export function feriesFrance(annee: number): { date: Date; libelle: string }[] {
  const p = paques(annee);
  const fixe = (m: number, j: number, libelle: string) => ({
    date: new Date(Date.UTC(annee, m - 1, j)),
    libelle,
  });
  return [
    fixe(1, 1, "jour de l'An"),
    { date: plusJours(p, 1), libelle: "lundi de Pâques" },
    fixe(5, 1, "fête du Travail"),
    fixe(5, 8, "victoire 1945"),
    { date: plusJours(p, 39), libelle: "Ascension" },
    { date: plusJours(p, 50), libelle: "lundi de Pentecôte" },
    fixe(7, 14, "fête nationale"),
    fixe(8, 15, "Assomption"),
    fixe(11, 1, "Toussaint"),
    fixe(11, 11, "Armistice"),
    fixe(12, 25, "Noël"),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Numéro de semaine ISO 8601. */
export function semaineIso(d: Date): number {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - debut.getTime()) / 86_400_000 + 1) / 7);
}

export function dateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateLisible(iso: string): string {
  const d = new Date(iso);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()} (${dateIso(d)})`;
}

/** Fériés dans les `horizonJours` à venir, à partir de `maintenant` inclus. */
export function feriesProches(
  maintenant: string,
  horizonJours = 21,
): { date: string; libelle: string }[] {
  const d = new Date(maintenant);
  const debut = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const fin = debut + horizonJours * 86_400_000;
  const annee = d.getUTCFullYear();
  return [...feriesFrance(annee), ...feriesFrance(annee + 1)]
    .filter((f) => f.date.getTime() >= debut && f.date.getTime() <= fin)
    .map((f) => ({ date: dateIso(f.date), libelle: f.libelle }));
}

/** La couche Instant, sans la question posée (elle appartient au profil). */
export function coucheInstant(
  maintenant: string,
  page?: string | null,
): string {
  const d = new Date(maintenant);
  const feries = feriesProches(maintenant);
  const lignes = [
    `# Aujourd'hui`,
    `${dateLisible(maintenant)} — semaine ${semaineIso(d)}`,
  ];
  if (feries.length) {
    lignes.push(
      `Jours fériés proches : ${feries.map((f) => `${f.libelle} le ${f.date}`).join(", ")}.`,
    );
  }
  if (page) lignes.push(`Page ouverte : ${page}`);
  return lignes.join("\n");
}
