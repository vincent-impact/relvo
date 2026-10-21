import type { CarteVivanteData } from "@/components/shared/carte-vivante";

// La MISE EN ROUTE d'une boîte : entre le retour de la page du fournisseur et
// la première tranche de lecture, il y a quelques secondes où rien n'existe
// encore en base — le webhook de connexion n'est pas passé, ou la ligne de
// rattrapage vient de naître. L'utilisateur doit pourtant voir qu'un travail
// a commencé (recette du 2026-10-21) : les pages montrent une carte vivante
// « en attente » et se rafraîchissent jusqu'à ce que la lecture existe.

/** Au-delà, une boîte connectée sans lecture n'est plus « en mise en route » : c'est une boîte d'avant le rattrapage. */
export const MISE_EN_ROUTE_MS = 30 * 60 * 1000;

type CanalEnRoute = {
  type: string;
  config: { externalAccountId: string | null; updatedAt: Date } | null;
  catchups: { id: string }[];
};

/** Une boîte e-mail connectée chez le fournisseur à l'instant, sans encore sa lecture. */
export function boiteEnMiseEnRoute(
  ch: CanalEnRoute,
  now: number = Date.now(),
): boolean {
  if (ch.type !== "email" || !ch.config?.externalAccountId) return false;
  if (ch.catchups.length > 0) return false;
  return now - ch.config.updatedAt.getTime() < MISE_EN_ROUTE_MS;
}

/** La carte d'une lecture qui n'a pas encore commencé : les compteurs à zéro, Relvo qui respire. */
export function carteEnAttente(channelName: string | null): CarteVivanteData {
  return {
    status: "pending",
    messagesImported: 0,
    messagesTriaged: 0,
    subjectsOpened: 0,
    conversationsIgnored: 0,
    candidatesTotal: null,
    importDone: false,
    stopReason: null,
    channelName,
  };
}
