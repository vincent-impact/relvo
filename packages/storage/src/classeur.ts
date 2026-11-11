import * as XLSX from "xlsx";
import { extensionDe } from "./fichiers";

export { estUnClasseur } from "./fichiers";

// Lecture d'un classeur (recette R18) — xlsx, xls, csv — en un APERÇU borné :
// les feuilles visibles, leurs premières lignes, chaque cellule telle qu'elle
// se lit à l'écran. C'est ce que l'application montre quand on touche un
// classeur reçu, et ce que Relvo lira d'une pièce (M8) : un seul lecteur, ici,
// à côté des octets.
//
// ⚠️ Module SERVEUR. La bibliothèque pèse plusieurs mégaoctets et lit un
// fichier venu de l'extérieur : elle n'entre jamais dans le navigateur, qui ne
// reçoit que le résultat. Un composant client n'importe d'ici que des TYPES.
//
// Trois garde-fous, parce que le fichier n'est pas le nôtre :
//   - l'appelant plafonne le poids AVANT de lire (`APERCU_MAX_OCTETS`) ;
//   - tout est borné — feuilles, lignes, colonnes, longueur d'une cellule,
//     volume total — et l'aperçu dit quand il a coupé ;
//   - rien ne lève : un fichier illisible rend une raison, que l'écran nomme.

/** Au-delà, on ne tente pas l'aperçu : un classeur se décompresse en mémoire. */
export const APERCU_MAX_OCTETS = 8 * 1024 * 1024;

export type LimitesClasseur = {
  feuilles: number;
  lignes: number;
  colonnes: number;
  /** Longueur d'une cellule, en caractères. */
  cellule: number;
  /** Volume total de l'aperçu, en caractères — il voyage en JSON. */
  volume: number;
};

export const LIMITES_APERCU: LimitesClasseur = {
  feuilles: 30,
  lignes: 500,
  colonnes: 60,
  cellule: 300,
  volume: 1_000_000,
};

export type FeuilleApercu = {
  nom: string;
  /** Les lignes montrées ; chaque ligne a la même largeur. */
  lignes: string[][];
  /** Ce que la feuille compte vraiment — pour dire ce que l'aperçu a coupé. */
  lignesTotal: number;
  colonnesTotal: number;
  tronquee: boolean;
};

export type ClasseurApercu = {
  feuilles: FeuilleApercu[];
  /** Les feuilles visibles du classeur, celles qu'on n'a pas montrées comprises. */
  feuillesTotal: number;
};

export type LectureClasseur =
  | { ok: true; classeur: ClasseurApercu }
  | { ok: false; raison: "illisible" | "protege" | "vide" };

function estCsv(nom: string, mimeType?: string | null): boolean {
  const ext = extensionDe(nom);
  if (ext) return ext === "csv";
  const type = (mimeType ?? "").toLowerCase();
  return type.startsWith("text/csv") || type.startsWith("application/csv");
}

/** Zip (xlsx) ou conteneur OLE (xls) : les deux seules signatures binaires. */
function estBinaireConnu(o: Uint8Array): boolean {
  const zip = o[0] === 0x50 && o[1] === 0x4b;
  const ole = o[0] === 0xd0 && o[1] === 0xcf && o[2] === 0x11 && o[3] === 0xe0;
  return zip || ole;
}

/**
 * Le texte d'un fichier dont on ne connaît pas l'encodage : UTF-8 quand il en
 * est (avec ou sans marque), UTF-16 quand la marque le dit, sinon le
 * Windows-1252 des exports de comptabilité — jamais des « Ã© » à l'écran.
 */
function decoder(octets: Uint8Array): string {
  if (octets[0] === 0xff && octets[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(octets.subarray(2));
  }
  if (octets[0] === 0xfe && octets[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(octets.subarray(2));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}

/**
 * Un nombre tel qu'un dirigeant français le lit : la bibliothèque rend
 * « 1,234.50 », l'écran montre « 1 234,50 ». Seul le nombre est touché, pas
 * ce qui l'entoure (devise, pourcentage).
 */
export function franciser(texte: string): string {
  return texte.replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/, (nombre) =>
    nombre.replace(/,/g, " ").replace(".", ","),
  );
}

function texteDeCellule(cellule: XLSX.CellObject | undefined): string {
  if (!cellule || cellule.t === "z" || cellule.v == null) return "";
  if (cellule.t === "b") return cellule.v ? "VRAI" : "FAUX";
  if (cellule.t === "e") return cellule.w ?? "#ERREUR";
  const lu = cellule.w ?? String(cellule.v);
  if (cellule.t === "n") {
    const date = typeof cellule.z === "string" && XLSX.SSF.is_date(cellule.z);
    return date ? lu : franciser(lu);
  }
  return lu;
}

function apercuDeFeuille(
  nom: string,
  feuille: XLSX.WorkSheet,
  limites: LimitesClasseur,
  volume: number,
): FeuilleApercu {
  const etendue = feuille["!fullref"] ?? feuille["!ref"];
  if (!etendue) {
    return {
      nom,
      lignes: [],
      lignesTotal: 0,
      colonnesTotal: 0,
      tronquee: false,
    };
  }
  const { s: debut, e: fin } = XLSX.utils.decode_range(etendue);
  const lignesTotal = fin.r + 1;
  const colonnesTotal = fin.c + 1;
  const largeur = Math.min(colonnesTotal, limites.colonnes);
  const hauteur = Math.min(lignesTotal, limites.lignes);
  const donnees = (feuille["!data"] ?? []) as (XLSX.CellObject | undefined)[][];

  const lignes: string[][] = [];
  let reste = volume;
  let coupee = false;
  for (let r = 0; r < hauteur; r++) {
    const source = donnees[r];
    const ligne: string[] = new Array(largeur).fill("");
    if (source && r >= debut.r) {
      for (let c = debut.c; c < largeur; c++) {
        let texte = texteDeCellule(source[c]);
        if (texte.length > limites.cellule) {
          texte = `${texte.slice(0, limites.cellule)}…`;
        }
        ligne[c] = texte;
        reste -= texte.length;
      }
    }
    // Trois caractères de ponctuation JSON par cellule, vide ou non.
    reste -= largeur * 3;
    if (reste < 0) {
      coupee = true;
      break;
    }
    lignes.push(ligne);
  }

  // Les lignes et colonnes vides de la fin n'apprennent rien.
  while (lignes.at(-1)?.every((t) => t === "")) {
    lignes.pop();
  }
  let utile = 0;
  for (const ligne of lignes) {
    for (let c = ligne.length - 1; c >= utile; c--) {
      if (ligne[c] !== "") {
        utile = c + 1;
        break;
      }
    }
  }
  const tronquee =
    coupee || lignesTotal > limites.lignes || colonnesTotal > limites.colonnes;
  // Coupé en largeur, on garde la largeur montrée : la mention dit le reste.
  const garde = colonnesTotal > limites.colonnes ? largeur : utile;

  return {
    nom,
    lignes: lignes.map((l) => l.slice(0, garde)),
    lignesTotal,
    colonnesTotal,
    tronquee,
  };
}

/**
 * Lit un classeur et rend son aperçu. Ne lève jamais : ce qui ne se lit pas
 * rend une raison.
 */
export function lireClasseur(
  octets: Uint8Array,
  fichier: { nom: string; mimeType?: string | null },
  limites: LimitesClasseur = LIMITES_APERCU,
): LectureClasseur {
  if (octets.byteLength === 0) return { ok: false, raison: "vide" };

  const options: XLSX.ParsingOptions = {
    dense: true,
    // Une ligne de plus que montré : la bibliothèque s'arrête là, et garde
    // l'étendue réelle de la feuille dans `!fullref`.
    sheetRows: limites.lignes + 1,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
    bookFiles: false,
    // Le format de date « court » d'Excel suit la langue du poste ; la
    // bibliothèque le rend à l'américaine si on ne le lui dit pas.
    dateNF: "dd/mm/yyyy",
  };

  let classeur: XLSX.WorkBook;
  try {
    if (!estCsv(fichier.nom, fichier.mimeType) && estBinaireConnu(octets)) {
      classeur = XLSX.read(octets, { ...options, type: "array" });
    } else {
      // Un CSV — ou un « .xls » qui est en réalité du texte (tableau HTML,
      // valeurs tabulées), courant dans les exports. Un fichier binaire sans
      // signature connue n'est pas un classeur.
      if (
        octets.subarray(0, 2048).includes(0) &&
        octets[0] !== 0xff &&
        octets[0] !== 0xfe
      ) {
        return { ok: false, raison: "illisible" };
      }
      // `raw` : un CSV se montre tel qu'écrit — « 00123 » reste « 00123 ».
      classeur = XLSX.read(decoder(octets), {
        ...options,
        type: "string",
        raw: true,
      });
    }
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    return {
      ok: false,
      raison: /password|encrypt/i.test(message) ? "protege" : "illisible",
    };
  }

  const etats = classeur.Workbook?.Sheets ?? [];
  const visibles = classeur.SheetNames.filter((_, i) => !etats[i]?.Hidden);
  const noms = visibles.length > 0 ? visibles : classeur.SheetNames;
  const montrees = noms.slice(0, limites.feuilles);
  if (montrees.length === 0) return { ok: false, raison: "vide" };

  const parFeuille = Math.floor(limites.volume / montrees.length);
  const feuilles = montrees.flatMap((nom) => {
    const feuille = classeur.Sheets[nom];
    return feuille ? [apercuDeFeuille(nom, feuille, limites, parFeuille)] : [];
  });

  if (feuilles.every((f) => f.lignes.length === 0)) {
    return { ok: false, raison: "vide" };
  }
  return { ok: true, classeur: { feuilles, feuillesTotal: noms.length } };
}
