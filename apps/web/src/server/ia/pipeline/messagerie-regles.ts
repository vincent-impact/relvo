import { MESSAGERIE } from "../config";

// Les RÈGLES du tri de la messagerie directe (M7, tranche 11), pures et
// testées sans base : la salve, l'ancre de l'écoute, ce qui fait taire par
// canal. Le pipeline les applique ; il ne les redéfinit pas. La reconnaissance
// d'un message d'historique est celle de l'e-mail (`estHistorique`,
// `./rattrapage-regles`), appliquée à la date de connexion du canal.

/**
 * Le tri d'un message ne se joue que si ce message est encore le DERNIER
 * ENTRANT de sa conversation après l'attente de la salve : sinon un message
 * plus récent l'a rejoint, et c'est son webhook qui portera le tri — une
 * salve, un tour.
 */
export function estDernierDeLaSalve(args: {
  declencheurId: string;
  dernierEntrantId: string | null;
}): boolean {
  return args.dernierEntrantId === args.declencheurId;
}

export type MessageDeSalve = {
  id: string;
  /** ISO 8601. */
  recuLe: string;
  /** Sans sujet et non ignoré : ce que l'écoute peut emporter. */
  orphelin: boolean;
};

/**
 * L'ANCRE de l'écoute que le tri pose : le plus ancien message orphelin daté
 * de moins de `fenetreMs` avant le déclencheur, parmi ceux que le modèle a
 * lus ; à défaut, le déclencheur lui-même. Un message plus vieux que la
 * fenêtre est un bavardage que le tri avait laissé sans sujet : il n'entre
 * pas dans celle-ci.
 */
export function ancreDeLaSalve(
  messages: readonly MessageDeSalve[],
  declencheur: { id: string; recuLe: string },
  fenetreMs: number = MESSAGERIE.fenetreSalveMs,
): string {
  const fin = Date.parse(declencheur.recuLe);
  if (Number.isNaN(fin)) return declencheur.id;
  const debut = fin - fenetreMs;
  const candidats = messages
    .filter((m) => m.orphelin)
    .map((m) => ({ id: m.id, t: Date.parse(m.recuLe) }))
    .filter((m) => !Number.isNaN(m.t) && m.t > debut && m.t <= fin)
    .sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  return candidats[0]?.id ?? declencheur.id;
}

export type Canal = "email" | "whatsapp";
export type NatureAvis =
  | "professionnel"
  | "publicite"
  | "automatique"
  | "personnel";
export type ConfianceAvis = "haute" | "moyenne" | "basse";

/**
 * Un « rien à faire » sûr fait-il TAIRE la source ? Sur l'e-mail, la règle de
 * `05 §9.5` : oui en confiance haute, quelle que soit la nature — une
 * newsletter, un accusé, un fil personnel n'ont pas à rester à trier. Sur un
 * fil WhatsApp direct, un « merci, bonne journée » n'est pas une raison de ne
 * plus écouter un client : seules la publicité et l'automatique mettent en
 * sourdine ; le professionnel et le personnel n'écrivent que l'avis, la
 * conversation reste vivante.
 */
export function peutFaireTaire(args: {
  canal: Canal;
  nature: NatureAvis;
  confiance: ConfianceAvis;
}): boolean {
  if (args.confiance !== "haute") return false;
  if (args.canal === "email") return true;
  return args.nature === "publicite" || args.nature === "automatique";
}
