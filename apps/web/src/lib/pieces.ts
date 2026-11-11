import { estUnClasseur, extensionDe } from "@relvo/storage/fichiers";
import type { ClasseurApercu } from "@relvo/storage/classeur";

// Ce que l'écran sait d'une pièce — pièce jointe d'un message ou connaissance
// d'un dossier — avant et après l'avoir ouverte (recette R18). Logique pure,
// partagée par le visualiseur (navigateur) et les routes qui le servent.

/** D'où vient la pièce : c'est ce qui choisit la route, jamais une clé de stockage. */
export type SourcePiece = "attachment" | "document";

/** L'adresse stable d'une pièce ; ses routes filles sont /download, /apercu, /contenu. */
export function adresseDePiece(source: SourcePiece, id: string): string {
  return source === "document"
    ? `/api/documents/${id}`
    : `/api/attachments/${id}`;
}

/**
 * Le geste qu'une pièce appelle quand on la touche :
 *   image    → visionneuse dans l'application ;
 *   pdf      → le lecteur du navigateur, qui les rend bien ;
 *   classeur → aperçu du tableau dans l'application ;
 *   autre    → l'écran du fichier (nom, type, poids, ouvrir avec, télécharger).
 */
export type GenrePiece = "image" | "pdf" | "classeur" | "autre";

export function genreDePiece(
  nom: string,
  mimeType?: string | null,
): GenrePiece {
  const type = (mimeType ?? "").toLowerCase();
  const ext = extensionDe(nom);
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("application/pdf") || ext === "pdf") return "pdf";
  if (estUnClasseur(nom, mimeType)) return "classeur";
  return "autre";
}

/**
 * La famille d'un fichier — ce qui choisit son icône et sa couleur
 * (`PieceIcone`). Le nom d'abord, le type à défaut : une pièce d'e-mail arrive
 * souvent typée « flux d'octets ».
 */
export type FamilleFichier =
  | "pdf"
  | "tableur"
  | "document"
  | "presentation"
  | "image"
  | "son"
  | "video"
  | "archive"
  | "autre";

const FAMILLES_PAR_EXTENSION: Record<string, FamilleFichier> = {
  pdf: "pdf",
  xlsx: "tableur",
  xlsm: "tableur",
  xls: "tableur",
  csv: "tableur",
  ods: "tableur",
  numbers: "tableur",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  pages: "document",
  txt: "document",
  md: "document",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  key: "presentation",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  svg: "image",
  mp3: "son",
  m4a: "son",
  ogg: "son",
  opus: "son",
  wav: "son",
  mp4: "video",
  mov: "video",
  webm: "video",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
};

export function familleDeFichier(
  nom: string,
  mimeType?: string | null,
): FamilleFichier {
  const connue = FAMILLES_PAR_EXTENSION[extensionDe(nom)];
  if (connue) return connue;
  const type = (mimeType ?? "").toLowerCase();
  if (type.startsWith("application/pdf")) return "pdf";
  if (estUnClasseur(nom, mimeType)) return "tableur";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "son";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("text/")) return "document";
  if (type.includes("wordprocessingml") || type === "application/msword") {
    return "document";
  }
  if (type.includes("presentationml") || type.includes("powerpoint")) {
    return "presentation";
  }
  if (type.includes("zip") || type.includes("compressed")) return "archive";
  return "autre";
}

const TYPES_PAR_EXTENSION: Record<string, string> = {
  xlsx: "Classeur Excel",
  xlsm: "Classeur Excel",
  xls: "Classeur Excel",
  csv: "Tableau CSV",
  doc: "Document Word",
  docx: "Document Word",
  ppt: "Présentation",
  pptx: "Présentation",
  pdf: "Document PDF",
  txt: "Texte",
  md: "Texte",
  zip: "Archive",
  rar: "Archive",
  "7z": "Archive",
  ics: "Invitation",
  vcf: "Fiche contact",
  eml: "E-mail",
  msg: "E-mail",
  dwg: "Plan",
  dxf: "Plan",
};

/** Le type d'un fichier, dit en clair — jamais un type MIME à l'écran. */
export function libelleDeType(nom: string, mimeType?: string | null): string {
  const ext = extensionDe(nom);
  const connu = TYPES_PAR_EXTENSION[ext];
  if (connu) return connu;
  const type = (mimeType ?? "").toLowerCase();
  if (estUnClasseur(nom, mimeType)) return "Classeur";
  if (type.startsWith("image/")) return "Image";
  if (type.startsWith("audio/")) return "Enregistrement audio";
  if (type.startsWith("video/")) return "Vidéo";
  if (type.startsWith("text/")) return "Texte";
  if (type.includes("wordprocessingml") || type === "application/msword") {
    return "Document Word";
  }
  // Une extension courte se montre ; un suffixe farfelu n'apprend rien.
  return /^[a-z0-9]{1,5}$/.test(ext)
    ? `Fichier ${ext.toUpperCase()}`
    : "Fichier";
}

/** Le poids d'un fichier, à la française : « 840 octets », « 12 Ko », « 1,2 Mo ». */
export function formatPoids(octets: number): string {
  if (octets < 1000) return `${octets} octet${octets > 1 ? "s" : ""}`;
  if (octets < 1000 * 1000) return `${Math.round(octets / 1000)} Ko`;
  const mo = octets / (1000 * 1000);
  const texte =
    mo < 10 ? mo.toFixed(1).replace(".", ",") : String(Math.round(mo));
  return `${texte.replace(/,0$/, "")} Mo`;
}

/** Pourquoi un aperçu n'a pas pu être montré. */
export type EchecApercu =
  | "absent"
  | "trop_lourd"
  | "protege"
  | "illisible"
  | "vide"
  | "reseau";

/** Ce que `/apercu` répond : l'identité du fichier, et son aperçu s'il en a un. */
export type ApercuPiece = {
  nom: string;
  mimeType: string | null;
  /** En octets ; `null` quand ni la base ni le stockage ne le disent. */
  taille: number | null;
  /** L'aperçu d'un classeur ; `null` pour un autre fichier ou un aperçu en échec. */
  classeur: ClasseurApercu | null;
  echec: Exclude<EchecApercu, "reseau"> | null;
};

/** La phrase qui dit pourquoi il n'y a pas d'aperçu — jamais un écran muet. */
export function phraseSansApercu(
  genre: GenrePiece,
  echec: EchecApercu | null,
): string {
  if (echec === "absent") return "Ce fichier n'est plus disponible.";
  if (genre !== "classeur") return "Relvo n'affiche pas ce type de fichier.";
  switch (echec) {
    case "trop_lourd":
      return "Ce classeur est trop lourd pour être affiché ici.";
    case "protege":
      return "Ce classeur est protégé par un mot de passe.";
    case "vide":
      return "Ce classeur est vide.";
    case "reseau":
      return "L'aperçu n'a pas pu être chargé.";
    default:
      return "L'aperçu de ce classeur n'a pas pu être affiché.";
  }
}

/** Le nom de colonne d'un tableur : 0 → A, 25 → Z, 26 → AA. */
export function lettreDeColonne(index: number): string {
  let n = index;
  let lettres = "";
  do {
    lettres = String.fromCharCode(65 + (n % 26)) + lettres;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return lettres;
}

/** Une cellule qui se lit comme un nombre s'aligne à droite, comme dans un tableur. */
export function estUnNombre(texte: string): boolean {
  return /^[-+(]?[\d   ]+(,\d+)?\)?\s?[%€$£]?$/.test(texte) && /\d/.test(texte);
}
