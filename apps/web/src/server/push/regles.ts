import type { PushKind } from "@relvo/db";

// LES RÈGLES DU PUSH (M12.7, M12.9) — module PUR, sans réseau ni base, tenu par
// `test/push.test.ts` : ce qu'une notification de Relvo contient, et quand un
// service de push nous dit qu'un appareil n'existe plus.

/** Une notification de Relvo : ce que le service worker affiche et ouvre. */
export type NotificationRelvo = {
  kind: PushKind;
  titre: string;
  corps: string;
  /** La page que le tap ouvre — un chemin de l'application. */
  url: string;
  /** Un même tag remplace la notification précédente (une question visible à la fois). */
  tag?: string;
};

/** La charge utile envoyée au worker — le JSON qu'il lit tel quel. */
export function chargeUtile(n: NotificationRelvo): string {
  return JSON.stringify({
    titre: n.titre,
    corps: n.corps,
    url: n.url,
    ...(n.tag ? { tag: n.tag } : {}),
  });
}

/**
 * 404 et 410 : l'abonnement n'existe plus chez le service de push — l'appareil
 * s'est désabonné, ou l'application a été désinstallée. On retire la ligne,
 * sans la retenter. Tout autre échec (429, 5xx, réseau) est passager : la ligne
 * reste, l'envoi suivant retentera.
 */
export function abonnementMort(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** Durée de vie côté service de push : passé ce délai sans réveil du téléphone, la notification est abandonnée. */
export const TTL_SECONDES: Readonly<Record<PushKind, number>> = {
  bienvenue: 60 * 10,
  // Un brief du matin qui arriverait le soir ne sert à rien.
  brief: 60 * 60 * 4,
  question: 60 * 60 * 24,
};

export const BIENVENUE: NotificationRelvo = {
  kind: "bienvenue",
  titre: "Relvo",
  corps:
    "Les notifications sont activées sur cet appareil. Vous aurez le brief du matin, et mes questions quand j'en ai.",
  url: "/preferences",
};
