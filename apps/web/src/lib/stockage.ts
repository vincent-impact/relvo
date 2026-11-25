// LA MESURE DU STOCKAGE (M25.1) — module PUR, sans base ni réseau, tenu par
// `test/stockage.test.ts` : comment les lignes de poids que rend le domaine se
// résument, comment le listing du bucket se rapproche de ce que la base
// connaît, et à partir de quand le stockage alerte. Le backoffice n'affiche
// que ce que ces fonctions rendent.

export type Famille = "video" | "image" | "audio" | "pdf" | "autre";
export type CanalDePiece = "email" | "whatsapp";

/** Une ligne de `mesurerLesPieces` (`@relvo/db`) — miroir structurel, pour rester sans import. */
export type LigneDePoids = {
  accountId: string;
  canal: CanalDePiece;
  famille: Famille;
  rattachee: boolean;
  ignoree: boolean;
  pieces: number;
  octets: number;
  sansTaille: number;
};

export type Poids = { pieces: number; octets: number };

const vide = (): Poids => ({ pieces: 0, octets: 0 });
const ajouter = (p: Poids, l: { pieces: number; octets: number }) => {
  p.pieces += l.pieces;
  p.octets += l.octets;
};

export const FAMILLES: readonly Famille[] = [
  "video",
  "image",
  "pdf",
  "audio",
  "autre",
];
export const LIBELLE_FAMILLE: Record<Famille, string> = {
  video: "Vidéos",
  image: "Images",
  pdf: "PDF",
  audio: "Audio",
  autre: "Autres documents",
};

export type ResumeDesPieces = {
  total: Poids;
  /** Pièces dont la base ne connaît pas la taille : absentes des octets. */
  sansTaille: number;
  parCanal: Record<CanalDePiece, Poids>;
  parFamille: Record<Famille, Poids>;
  /** Ce qu'un sujet porte — ce qui a vocation à rester. */
  tenues: Poids;
  /** Sans sujet, dans une conversation vivante : ce que la politique des médias vise (M25.3 à M25.6). */
  libres: Poids;
  /** Sans sujet, dans une conversation ignorée : ce que la purge retire (M25.12). */
  ignorees: Poids;
  parCompte: Record<string, Poids>;
};

/** Les totaux que le backoffice montre, tirés des lignes du domaine. */
export function resumerLesPieces(
  lignes: readonly LigneDePoids[],
): ResumeDesPieces {
  const r: ResumeDesPieces = {
    total: vide(),
    sansTaille: 0,
    parCanal: { email: vide(), whatsapp: vide() },
    parFamille: {
      video: vide(),
      image: vide(),
      audio: vide(),
      pdf: vide(),
      autre: vide(),
    },
    tenues: vide(),
    libres: vide(),
    ignorees: vide(),
    parCompte: {},
  };
  for (const l of lignes) {
    ajouter(r.total, l);
    r.sansTaille += l.sansTaille;
    ajouter(r.parCanal[l.canal], l);
    ajouter(r.parFamille[l.famille], l);
    // Ce qu'un sujet porte reste, même dans une conversation ignorée : la
    // purge ne le touche pas.
    ajouter(l.rattachee ? r.tenues : l.ignoree ? r.ignorees : r.libres, l);
    ajouter((r.parCompte[l.accountId] ??= vide()), l);
  }
  return r;
}

export type Objets = { objets: number; octets: number };

/** L'état du bucket, lu chez le fournisseur et rapproché de la base. */
export type EtatDuBucket = {
  /** ISO 8601 — quand le bucket a été lu. */
  luLe: string;
  /** Faux quand le listing a été coupé à son plafond : les totaux sont des minorants. */
  complet: boolean;
  total: Objets;
  parCompte: Record<string, Objets>;
  /** Objets rangés hors de la convention `accounts/<compte>/…`. */
  horsComptes: Objets;
  /**
   * Dans le bucket, mais ni connus de la base ni en file de suppression : ce
   * qu'un effacement a laissé derrière lui. Zéro est la preuve que la file
   * vide bien le bucket.
   */
  sansProprietaire: Objets;
  /** Dans le bucket et en file de suppression : ils partiront au prochain drainage. */
  enAttente: Objets;
  /** Connus de la base, absents du bucket : une pièce qui ne s'ouvrira pas. */
  manquants: number;
  /**
   * Le même fichier stocké plusieurs fois DANS UN MÊME COMPTE (même empreinte,
   * même poids) : ce qu'une déduplication rendrait (M25.8). Chaque exemplaire
   * au-delà du premier compte ; un objet sans empreinte n'est pas compté.
   */
  doublons: Objets;
};

/**
 * Rapproche le listing du bucket de ce que la base connaît. `compteDe` lit le
 * compte dans une clé (`ownerOfObjectKey`, `@relvo/storage`) — passé en
 * argument pour que ce module reste sans import.
 */
export function rapprocherLeBucket(args: {
  objets: readonly { key: string; size: number; etag?: string | null }[];
  complet: boolean;
  connues: readonly string[];
  enAttente: readonly string[];
  compteDe: (key: string) => string | null;
  luLe: Date;
}): EtatDuBucket {
  const connues = new Set(args.connues);
  const enAttente = new Set(args.enAttente);
  const o = (): Objets => ({ objets: 0, octets: 0 });
  const compter = (x: Objets, size: number) => {
    x.objets += 1;
    x.octets += size;
  };
  const etat: EtatDuBucket = {
    luLe: args.luLe.toISOString(),
    complet: args.complet,
    total: o(),
    parCompte: {},
    horsComptes: o(),
    sansProprietaire: o(),
    enAttente: o(),
    manquants: 0,
    doublons: o(),
  };
  const vues = new Set<string>();
  const contenus = new Set<string>();
  for (const { key, size, etag } of args.objets) {
    vues.add(key);
    compter(etat.total, size);
    const compte = args.compteDe(key);
    if (compte) compter((etat.parCompte[compte] ??= o()), size);
    else compter(etat.horsComptes, size);
    if (compte && etag) {
      const contenu = `${compte}|${etag}|${size}`;
      if (contenus.has(contenu)) compter(etat.doublons, size);
      else contenus.add(contenu);
    }
    if (connues.has(key)) continue;
    // Une clé en file est attendue : elle n'est pas « sans propriétaire ».
    compter(enAttente.has(key) ? etat.enAttente : etat.sansProprietaire, size);
  }
  // Un listing coupé ne permet pas de dire qu'une clé manque.
  if (args.complet) {
    for (const key of connues) if (!vues.has(key)) etat.manquants += 1;
  }
  return etat;
}

/** Au-delà de cette part du repère, le stockage alerte — comme le plafond de l'inférence. */
export const SEUIL_ALERTE_STOCKAGE = 0.8;

/** Le repère par défaut : le palier que le fournisseur offre, en gigaoctets. */
export const REPERE_STOCKAGE_GO = 10;

export function niveauDuStockage(
  octets: number,
  repereOctets: number,
): { part: number; pct: number; alerte: boolean } {
  const part = repereOctets > 0 ? octets / repereOctets : 0;
  return {
    part,
    pct: Math.min(100, Math.round(part * 100)),
    alerte: part >= SEUIL_ALERTE_STOCKAGE,
  };
}

const KO = 1024;
const MO = KO * 1024;
const GO = MO * 1024;

/** « 7,59 Go », « 10 Go », « 340 Mo », « 12 Ko », « 0 » — en unités binaires, virgule française. */
export function octets(n: number): string {
  if (n <= 0) return "0";
  // Un compte rond s'écrit sans décimales : « 10 Go », pas « 10,0 Go ».
  const fr = (x: number, d: number) =>
    x.toFixed(d).replace(/\.0+$/, "").replace(".", ",");
  if (n >= GO) return `${fr(n / GO, n >= 10 * GO ? 1 : 2)} Go`;
  if (n >= MO) return `${fr(n / MO, n >= 100 * MO ? 0 : 1)} Mo`;
  if (n >= KO) return `${fr(n / KO, 0)} Ko`;
  return `${n} o`;
}

/**
 * Un nombre avec ses milliers séparés d'une espace fine insécable — écrit à la
 * main : le formatage par la locale diffère entre le serveur et le téléphone.
 */
export function nombre(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** « 1 fichier », « 15 536 fichiers ». */
export function compte(n: number, un: string, des: string): string {
  return `${nombre(n)} ${n > 1 ? des : un}`;
}

/** La part d'un poids dans un total, en pourcentage entier ; « — » sans total. */
export function partDe(octetsPartie: number, octetsTotal: number): string {
  if (octetsTotal <= 0) return "—";
  return `${Math.round((octetsPartie / octetsTotal) * 100)} %`;
}
