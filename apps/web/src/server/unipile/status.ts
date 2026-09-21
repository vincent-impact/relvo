import type { ChannelConfigStatus } from "@relvo/db";

// L'état d'un compte chez Unipile, traduit dans le vocabulaire du domaine
// (M5.8). UNE seule table, lue par le webhook d'état de compte ET par la page
// Canaux qui réconcilie le badge avec ce que le fournisseur dit du compte —
// deux lectures de la même vérité ne doivent jamais diverger (PITFALLS #53).
//
// Vocabulaire Unipile, confirmé contre le SDK (`sources[].status`) et le
// webhook « Account status » (`message`) : OK · CREDENTIALS · PERMISSIONS ·
// ERROR · STOPPED · CONNECTING · DELETED · DISCONNECTED, plus les fins de
// hosted auth CREATION_SUCCESS · RECONNECTED et la synchro SYNC_SUCCESS.
//
// Module PUR, testé sans base : l'énuméré n'est importé qu'en type — importer
// sa valeur depuis `@relvo/db` instancierait le client Prisma à l'import.

const CONNECTED = new Set([
  "OK",
  "CONNECTED",
  "CREATION_SUCCESS",
  "RECONNECTED",
  "SYNC_SUCCESS",
]);
const PENDING = new Set(["CONNECTING"]);
const ERROR = new Set([
  "CREDENTIALS",
  "PERMISSIONS",
  "ERROR",
  "STOPPED",
  "DELETED",
  "DISCONNECTED",
  "RECONNECT",
]);

/**
 * Un libellé Unipile → un statut du domaine, ou `null` quand le libellé est
 * inconnu ou vide : on ne DEVINE pas un état — un statut faux coûte plus cher
 * qu'un statut inchangé.
 */
export function statutDepuisUnipile(
  raw: string | null | undefined,
): ChannelConfigStatus | null {
  const label = (raw ?? "").trim().toUpperCase();
  if (!label) return null;
  if (CONNECTED.has(label)) return "connected";
  if (PENDING.has(label)) return "pending";
  if (ERROR.has(label)) return "error";
  return null;
}

/**
 * L'état d'un compte d'après ses SOURCES (une boîte mail = une source, un
 * WhatsApp = une source). Le pire l'emporte : une source en erreur suffit à
 * dire « erreur », une source qui se connecte suffit à dire « en attente », et
 * il faut que toutes soient OK pour dire « connecté ». Sans source lisible,
 * `null` : on garde ce qu'on savait.
 */
export function statutDepuisSources(
  sources: readonly { status?: string | null }[] | null | undefined,
): ChannelConfigStatus | null {
  if (!sources?.length) return null;
  const statuts = sources.map((s) => statutDepuisUnipile(s.status));
  if (statuts.includes("error")) {
    return "error";
  }
  if (statuts.includes("pending")) {
    return "pending";
  }
  if (statuts.every((s) => s === "connected")) {
    return "connected";
  }
  return null;
}
