import { timingSafeEqual } from "node:crypto";

// Authentification des webhooks Unipile (M5.2).
//
// Unipile n'utilise PAS de signature HMAC : à la création d'un webhook, on
// configure un header secret custom `Unipile-Auth`. La vérification consiste
// donc à comparer, en temps constant, la valeur reçue à notre secret.
// (Réf. developer.unipile.com/docs/webhooks-2 — « add header with a secret key
// to authenticate webhook coming from Unipile ».)

export const UNIPILE_AUTH_HEADER = "unipile-auth";

/** Comparaison à temps constant, robuste aux longueurs différentes. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Vérifie qu'une requête entrante vient bien d'Unipile.
 *
 * Deux canaux d'authentification, car Unipile n'expose pas le même mécanisme
 * partout :
 *   - les **webhooks managés** (`mail_received`…) portent le header custom
 *     `Unipile-Auth` qu'on a configuré à leur création ;
 *   - le **callback `notify_url`** du hosted auth ne porte aucun header custom →
 *     on le sécurise par un **token en query-string** (`?secret=…`), qu'on met
 *     nous-mêmes dans l'URL de notification.
 * Le secret est le même des deux côtés (`UNIPILE_WEBHOOK_SECRET`).
 *
 * Dégradation propre en dev : sans secret configuré, on accepte en journalisant
 * (mêmes mœurs que `lib/email.ts` sans clé Resend) — jamais en prod.
 */
export function verifyWebhookAuth(
  headerValue: string | null,
  queryToken?: string | null,
): boolean {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[unipile] UNIPILE_WEBHOOK_SECRET absent — requête acceptée sans vérification (dev uniquement).",
    );
    return true;
  }
  if (headerValue != null && safeEqual(headerValue, secret)) return true;
  if (queryToken != null && safeEqual(queryToken, secret)) return true;
  return false;
}
