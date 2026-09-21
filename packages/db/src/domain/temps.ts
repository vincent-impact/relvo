// L'HEURE DE RELVO EST L'HEURE FRANÇAISE — le domicile unique de cette règle.
//
// Le produit s'adresse à des dirigeants français : « j'arrive dans 1h » à 19h
// veut dire 20h à Paris, jamais 18h à Greenwich. Le serveur, lui, tourne en UTC.
// Sans ce module, chaque `getUTCDate()` ou `toISOString()` glisse d'une ou deux
// heures — assez pour poser un rendez-vous au mauvais moment, et pour appeler
// « hier » le jour même entre minuit et deux heures du matin (PITFALLS #55).
//
// DEUX SORTES DE TEMPS, à ne jamais confondre :
//
//   · un INSTANT (`Message.receivedAt`, `Task.completedAt`) est un point sur la
//     ligne du temps, stocké en UTC. Il se COMPARE tel quel, et ne se LIT qu'à
//     travers ce module.
//   · une HEURE DE CALENDRIER (`Task.start_date`, `start_time`) est ce que le
//     dirigeant a écrit sur son agenda : « le 21 à 20:00 ». Elle est stockée NUE
//     (date et heure sans fuseau, cf. `02-modele-donnees.md`) et s'affiche telle
//     quelle. Cette heure nue est, par convention, l'heure FRANÇAISE.
//
// L'affichage respecte déjà la seconde règle (`timeZone: "UTC"` sur une valeur
// nue = la rendre inchangée). Ce module tient la première : il traduit un
// instant en calendrier français, et rien d'autre.

/** Le fuseau du produit. Une seule valeur, un seul endroit. */
export const FUSEAU = "Europe/Paris";

const FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type CalendrierParis = {
  annee: number;
  /** 1–12, comme on le dit, pas comme `Date` le compte. */
  mois: number;
  jour: number;
  heures: number;
  minutes: number;
};

/**
 * Les composantes du calendrier français d'un instant. Passe par `Intl`, seul
 * moyen correct : l'heure d'été et d'hiver n'est pas un décalage constant, et
 * la coder à la main est le bug qu'on croit avoir évité.
 */
export function calendrierParis(at: Date): CalendrierParis {
  const p: Record<string, string> = {};
  for (const { type, value } of FORMAT.formatToParts(at)) p[type] = value;
  // `hour12: false` rend minuit « 24 » dans certaines implémentations.
  const heures = Number(p.hour) % 24;
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heures,
    minutes: Number(p.minute),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Le jour civil français d'un instant, « AAAA-MM-JJ ». */
export function jourParis(at: Date = new Date()): string {
  const c = calendrierParis(at);
  return `${c.annee}-${pad(c.mois)}-${pad(c.jour)}`;
}

/** L'heure civile française d'un instant, « HH:MM ». */
export function heureParis(at: Date = new Date()): string {
  const c = calendrierParis(at);
  return `${pad(c.heures)}:${pad(c.minutes)}`;
}

/** Un instant, en calendrier français : « 2026-09-21 19:31 ». */
export function horodatageParis(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return `${jourParis(d)} ${heureParis(d)}`;
}

/**
 * Le début du jour civil français, en DATE NUE — la valeur à comparer aux
 * `@db.Date` du modèle (`Task.start_date`), qui sont elles-mêmes nues. Ce n'est
 * donc PAS l'instant de minuit à Paris, et ça ne doit pas l'être : comparer une
 * date nue à un instant réel décale la frontière du jour d'une ou deux heures.
 */
export function debutDuJourParis(at: Date = new Date()): Date {
  const c = calendrierParis(at);
  return new Date(Date.UTC(c.annee, c.mois - 1, c.jour));
}

/** Une date nue (`AAAA-MM-JJ`) → la valeur stockée pour ce jour de calendrier. */
export function dateNue(jour: string): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

/** Le jour civil français décalé de `jours`, en date nue. */
export function jourDecale(at: Date, jours: number): Date {
  const d = debutDuJourParis(at);
  d.setUTCDate(d.getUTCDate() + jours);
  return d;
}
