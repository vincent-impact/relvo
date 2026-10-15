import type { Tx } from "../tenant";

// Génération de la référence lisible d'un Subject (SUB-00001).
//
// ⚠️ La séquence dérive du MAXIMUM existant, pas du NOMBRE de sujets. La version
// initiale faisait `count + 1`, ce qui casse dès qu'un sujet est supprimé : le
// compteur redescend et repointe sur une référence déjà attribuée
// (P2002 sur `@@unique([accountId, reference])`, constaté en prod le 2026-07-20
// après suppression manuelle de sujets).
//
// Limite assumée : supprimer le sujet le PLUS RÉCENT fait redescendre le
// maximum, donc sa référence est réattribuée au suivant. Ce n'est PAS une
// collision (la ligne n'existe plus) et rien ne casse. Garantir une séquence
// strictement monotone exigerait un compteur persistant par compte — machinerie
// disproportionnée pour un identifiant d'affichage. Verrouillé par un test
// explicite (`test/subject-reference.test.ts`) pour que personne ne croie à une
// garantie plus forte.

const PREFIX = "SUB";
const PAD = 5;

export function formatSubjectReference(seq: number): string {
  return `${PREFIX}-${String(seq).padStart(PAD, "0")}`;
}

/**
 * Extrait la partie numérique d'une référence. Tolérant : une référence saisie
 * à la main et hors format (ex. « RH-0042 », cf. 02-modele-donnees §6) renvoie
 * 0 et n'entre donc pas dans le calcul du maximum.
 */
function sequenceOf(reference: string): number {
  const m = /^SUB-(\d+)$/.exec(reference);
  return m ? Number(m[1]) : 0;
}

/**
 * Calcule la prochaine référence disponible pour le compte courant. À appeler
 * dans la transaction de création du Subject (le client tenant scope la lecture).
 *
 * Le tri se fait sur la chaîne : c'est correct tant que le padding est fixe
 * (`SUB-00042`), donc l'ordre lexicographique et l'ordre numérique coïncident.
 * Il cesserait de l'être au-delà de 99 999 sujets — d'où la garde — et il
 * l'est déjà pour une référence à padding différent — d'où la sonde.
 */
export async function nextSubjectReference(db: Tx): Promise<string> {
  const last = await db.subject.findFirst({
    where: { reference: { startsWith: `${PREFIX}-` } },
    select: { reference: true },
    orderBy: { reference: "desc" },
  });
  let next = (last ? sequenceOf(last.reference) : 0) + 1;
  // Le maximum lexicographique n'est le maximum numérique QUE si toutes les
  // références ont le même padding. Une référence à quatre chiffres
  // (« SUB-0219 », le jeu de démonstration, une saisie à la main) passe
  // devant « SUB-00220 » dans l'ordre des chaînes : le calcul repropose alors
  // 220 à chaque création, et la deuxième casse en P2002 (constaté le
  // 2026-10-15, M19.10). On SONDE donc la référence calculée et on avance
  // tant qu'elle est prise — quelques lectures dans la transaction, jamais une
  // collision.
  for (let essais = 0; essais < 1000; essais++) {
    if (next > 99_999) {
      // Au-delà du padding, l'ordre lexicographique ne suit plus l'ordre
      // numérique et ce calcul deviendrait faux en silence. Mieux vaut échouer
      // bruyamment que distribuer des références en doublon.
      throw new Error(
        "Séquence de référence Subject épuisée (> 99 999) : élargir PAD.",
      );
    }
    const candidate = formatSubjectReference(next);
    const taken = await db.subject.findFirst({
      where: { reference: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    next += 1;
  }
  throw new Error(
    "Séquence de référence Subject : mille références prises d'affilée.",
  );
}
