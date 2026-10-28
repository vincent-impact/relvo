import "server-only";

// Point d'entrée de la frontière du courrier (M24.1) : le contrat, le choix du
// fournisseur, l'envoi, le rangement et la réception. La garde `server-only`
// est posée ICI : les modules restent importables par un script en ligne de
// commande, l'application passe par l'index.

export * from "./types";
export { estUnFournisseur, fournisseurDe } from "./fournisseur";
export { courrierEmailSender } from "./envoi";
export { stockerPiecesJointes } from "./pieces-jointes";
export {
  rangerCourrier,
  recevoirCourrier,
  type BilanRangement,
  type BilanReception,
} from "./reception";
