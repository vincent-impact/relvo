import type { IngestInboundEmailInput } from "@relvo/db";
import type { UnipileMailWebhook } from "./types";

// Mapper PUR : payload webhook Unipile → entrée normalisée du domaine (M5.3).
// Isolé et sans effet de bord pour être testable sans base ni réseau.

/**
 * Extrait un signal de fil (`in_reply_to`) robuste. Unipile documente ce champ
 * comme un id de message parent, mais l'envoie en pratique tantôt en `string`
 * (premier email), tantôt en **objet** `{ id, ... }` (vraie réponse) — sans
 * garde-fou, l'objet remontait jusqu'à Zod et faisait crasher l'ingestion en
 * 500 (le webhook rejouait alors en boucle). On ne garde qu'une string, sinon
 * `null` : ce n'est qu'un signal faible pour M7, les conversations sont de toute
 * façon regroupées par contact en V1 (invariant produit n°11).
 */
function threadHint(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object") {
    const id =
      (v as { id?: unknown }).id ?? (v as { message_id?: unknown }).message_id;
    return typeof id === "string" && id.trim() ? id : null;
  }
  return null;
}

/** Corps lisible : on privilégie le texte brut, sinon on dé-balise le HTML. */
function plainContent(mail: UnipileMailWebhook): string | null {
  if (mail.body_plain?.trim()) return mail.body_plain;
  if (mail.body?.trim()) {
    return mail.body
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return null;
}

/**
 * Convertit un `mail_received` en entrée `ingestInboundEmail`. `senderRaw` porte
 * l'adresse email brute (cf. modèle : « L'information brute de l'expéditeur
 * (adresse email ou numéro) »). `channelId` provient de la résolution du tenant
 * (ChannelConfig.externalAccountId → Channel), pas du payload.
 */
export function toInboundEmail(
  mail: UnipileMailWebhook,
  channelId: string,
): IngestInboundEmailInput {
  const receivedAt = mail.date ? new Date(mail.date) : null;
  return {
    channelId,
    externalId: mail.email_id,
    // Le webhook email d'Unipile n'expose pas d'id de FIL de discussion (que
    // `provider_id` = id provider du message, et `in_reply_to` = message parent).
    // On ne fabrique donc pas de thread id ; les conversations sont de toute
    // façon regroupées par contact en V1 (invariant produit n°11). `in_reply_to`
    // est conservé comme signal faible pour M7, coercé en string-ou-null.
    externalThreadId: threadHint(mail.in_reply_to),
    senderRaw: mail.from_attendee?.identifier ?? null,
    subjectLine: mail.subject ?? null,
    content: plainContent(mail),
    receivedAt:
      receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
  };
}
