// Les projections et les formats du backoffice (M21) — module PUR, sans import
// de `@relvo/db` (qui instancierait le client Prisma) : ce que les composants
// clients reçoivent est projeté champ par champ (PITFALLS #41), jamais la ligne
// du domaine entière.

/** Ce qu'un composant client du backoffice connaît d'un compte. */
export type CompteAdminVue = {
  id: string;
  email: string;
  assistantEnabled: boolean;
  isTest: boolean;
  enAttente: boolean;
};

export function eur(n: number): string {
  if (n === 0) return "0 €";
  if (n < 0.01) return `${n.toFixed(4)} €`;
  if (Number.isInteger(n)) return `${n} €`;
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** « il y a 3 j », « il y a 2 h », « à l'instant » — en français, sans seconde. */
export function depuis(at: Date | null, now: Date = new Date()): string {
  if (!at) return "jamais";
  const s = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 31) return `il y a ${j} j`;
  const mois = Math.round(j / 30);
  return `il y a ${mois} mois`;
}

export function dateCourte(at: Date): string {
  return at.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

export const LIBELLE_STATUT_CANAL: Record<string, string> = {
  connected: "connecté",
  pending: "en attente",
  error: "en erreur",
  disconnected: "déconnecté",
};

export function libelleStatutCanal(status: string | null): string {
  if (!status) return "sans configuration";
  return LIBELLE_STATUT_CANAL[status] ?? status;
}

export const LIBELLE_SECTEUR: Record<string, string> = {
  food: "food",
  construction: "bâtiment",
  other: "autre",
};

export function pluriel(n: number, un: string, des: string): string {
  return `${n} ${n > 1 ? des : un}`;
}

/** Le fournisseur derrière un canal (M24.1), dans les mots du backoffice. */
export function libelleFournisseur(provider: string): string {
  return provider === "gmail" ? "relais Gmail" : "agrégateur";
}
