import type { Secteur } from "../produit";
import { lexiqueDe } from "../produit/lexique";

// LE PROMPT DE TRANSCRIPTION (M22.4) — ce que le fournisseur lit avant
// d'écouter : une phrase de cadre, puis les noms du compte, puis les mots du
// secteur. Un modèle de transcription n'obéit pas à une consigne : il
// s'ALIGNE sur un texte qui ressemble à ce qu'il va entendre. D'où la forme —
// une liste en prose, pas des instructions — et le plafond : au-delà d'un
// court préfixe, le reste n'est pas lu, et un compte à mille contacts ne doit
// pas le pousser. Ordre stable, pour qu'un même compte donne le même prompt.
//
// Module PUR : la lecture du compte est dans le domaine
// (`getDictationVocabulary`), la projection est explicite (PITFALLS #41).

export const PLAFOND_PROMPT_DICTEE = 1_200;

export type VocabulaireDictee = {
  dirigeant: string;
  /** Les secteurs tels que le domaine les rend ; un inconnu est ignoré. */
  secteurs: readonly string[];
  contacts: readonly {
    prenom: string | null;
    nom: string;
    entreprise: string | null;
  }[];
  affaires: readonly string[];
};

const SECTEUR_EN_CLAIR: Record<Secteur, string | null> = {
  food: "restauration",
  construction: "bâtiment",
  other: null,
};

function secteursConnus(secteurs: readonly string[]): Secteur[] {
  return secteurs.filter((s): s is Secteur => s in SECTEUR_EN_CLAIR);
}

function nomComplet(c: VocabulaireDictee["contacts"][number]): string {
  const nom = [c.prenom, c.nom].filter(Boolean).join(" ");
  return c.entreprise ? `${nom} (${c.entreprise})` : nom;
}

/** Ajoute des éléments séparés par des virgules tant que le plafond tient. */
function liste(
  prefixe: string,
  elements: readonly string[],
  reste: number,
): string | null {
  if (!elements.length || reste <= prefixe.length) return null;
  let s = prefixe;
  let n = 0;
  for (const e of elements) {
    const ajout = (n ? ", " : "") + e;
    if (s.length + ajout.length + 1 > reste) break;
    s += ajout;
    n += 1;
  }
  return n ? `${s}.` : null;
}

export function promptDictee(v: VocabulaireDictee): string {
  const connus = secteursConnus(v.secteurs);
  const secteurs = connus
    .map((s) => SECTEUR_EN_CLAIR[s])
    .filter((s): s is string => s !== null);
  const cadre = `Dictée en français${v.dirigeant ? ` de ${v.dirigeant}` : ""}${
    secteurs.length ? `, ${secteurs.join(" et ")}` : ""
  }.`;
  const parties = [cadre];
  let reste = PLAFOND_PROMPT_DICTEE - cadre.length;
  for (const [prefixe, elements] of [
    ["Contacts : ", v.contacts.map(nomComplet)],
    ["Affaires : ", v.affaires],
    ["Mots : ", lexiqueDe(connus)],
  ] as const) {
    const l = liste(prefixe, elements, reste - 1);
    if (!l) continue;
    parties.push(l);
    reste -= l.length + 1;
  }
  return parties.join(" ");
}
