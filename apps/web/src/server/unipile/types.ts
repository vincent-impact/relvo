// Types du fournisseur d'intégration Unipile (M5 — ingestion email).
//
// Unipile est l'agrégateur unifié email + WhatsApp (décision 2026-07-16, cf.
// docs/spec/architecture.md). Il porte l'envoi « au nom de » l'utilisateur, la
// réception temps réel par webhooks, et le multi-provider (Gmail/Outlook/IMAP).
// On modélise ici la portion du contrat qu'on consomme — volontairement
// tolérante (champs optionnels) car un provider tiers peut enrichir ses payloads.

/** Un interlocuteur email tel que normalisé par Unipile. */
export type UnipileAttendee = {
  /** Adresse email (ou identifiant du canal). */
  identifier: string;
  display_name?: string | null;
};

/** Descripteur de pièce jointe dans un webhook `mail_received`. */
export type UnipileAttachmentRef = {
  id: string;
  name?: string | null;
  /** Type MIME (parfois `mime` ou `content_type` selon la source). */
  mime?: string | null;
  content_type?: string | null;
  size?: number | null;
};

/**
 * Webhook d'email (entrant/sortant). `event` discrimine le type. Champs alignés
 * sur le contrat du SDK (`WebhookCreateEmailBodySchema.data.key`) : `email_id`,
 * `account_id`, `from_attendee`, `to_attendees`, `subject`, `body`,
 * `body_plain`, `date`, `attachments`, `provider_id`, `in_reply_to`…
 */
export type UnipileMailWebhook = {
  event: "mail_received" | "mail_sent" | "mail_moved";
  account_id: string;
  email_id: string;
  /** Id provider du message (pas un id de fil). */
  provider_id?: string | null;
  /** Id du message parent (réponse à) — signal de fil faible pour M7. Unipile
   *  l'envoie tantôt en string, tantôt en objet `{ id }` : coercé par `map.ts`. */
  in_reply_to?: string | Record<string, unknown> | null;
  from_attendee?: UnipileAttendee | null;
  to_attendees?: UnipileAttendee[] | null;
  cc_attendees?: UnipileAttendee[] | null;
  bcc_attendees?: UnipileAttendee[] | null;
  subject?: string | null;
  /** Corps HTML. */
  body?: string | null;
  /** Corps texte brut. */
  body_plain?: string | null;
  /** Date ISO 8601. */
  date?: string | null;
  has_attachments?: boolean | null;
  attachments?: UnipileAttachmentRef[] | null;
};

/**
 * Un interlocuteur de messagerie (WhatsApp) tel que normalisé par Unipile. Le
 * numéro brut vit dans `attendee_provider_id` (ex. `33612345678@s.whatsapp.net`)
 * ou `provider_id` selon la source ; on lit de façon tolérante côté mapper.
 */
export type UnipileMessagingAttendee = {
  attendee_id?: string | null;
  attendee_name?: string | null;
  attendee_provider_id?: string | null;
  provider_id?: string | null;
};

/** Descripteur de média dans un webhook `message_received`. */
export type UnipileMessagingAttachmentRef = {
  id: string;
  type?: string | null;
  name?: string | null;
  file_name?: string | null;
  mime?: string | null;
  mimetype?: string | null;
  size?: number | null;
};

/**
 * Webhook de messagerie (WhatsApp via Unipile, source `messaging`). `event`
 * discrimine `message_received` (le seul utile en V1) de `message_read` /
 * `message_reaction` (ignorés). Champs alignés sur le contrat du SDK
 * (`WebhookCreateMessagingBodySchema.data.key`) : `message` (texte), `account_id`,
 * `chat_id`, `message_id`, `sender`, `attendees`, `attachments`, `timestamp`,
 * `account_type`. Volontairement tolérant (tout optionnel sauf `event`).
 */
export type UnipileMessagingWebhook = {
  event: "message_received" | "message_read" | "message_reaction";
  account_id?: string | null;
  /** Fil de discussion — devient `Message.externalThreadId` (clé de rattachement
   *  ET de réponse). */
  chat_id?: string | null;
  /** Id du message chez Unipile — idempotence (`Message.externalId`). */
  message_id?: string | null;
  /** Corps texte du message. */
  message?: string | null;
  /** Auteur du message (numéro dans `attendee_provider_id` / `provider_id`). */
  sender?: UnipileMessagingAttendee | null;
  attendees?: UnipileMessagingAttendee[] | null;
  attachments?: UnipileMessagingAttachmentRef[] | null;
  /** Type de compte (`WHATSAPP`…). */
  account_type?: string | null;
  /** Horodatage ISO 8601 (ou epoch selon la source). */
  timestamp?: string | number | null;
};

/**
 * Notification de fin de hosted auth (posée sur `notify_url`). Relie le compte
 * Unipile fraîchement connecté à notre Channel (via `name` = channelId).
 */
export type UnipileHostedAuthNotify = {
  status: "CREATION_SUCCESS" | "RECONNECTED";
  account_id: string;
  /** Identifiant interne qu'on a passé à la création du lien (notre channelId). */
  name: string;
};

/**
 * Webhook de changement d'état d'un compte connecté (déconnexion, reauth
 * requise…). La forme exacte varie ; on ne lit que le compte et un libellé.
 */
export type UnipileAccountStatusWebhook = {
  account_id: string;
  /** Ex. `OK`, `CREDENTIALS`, `DISCONNECTED`, `RECONNECT`… selon Unipile. */
  status?: string | null;
  message?: string | null;
};

/** Union tolérante de tout payload reçu sur notre endpoint webhook unique. */
export type UnipileWebhookPayload =
  | UnipileMailWebhook
  | UnipileMessagingWebhook
  | UnipileHostedAuthNotify
  | UnipileAccountStatusWebhook
  | Record<string, unknown>;

export function isMailWebhook(p: unknown): p is UnipileMailWebhook {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as { event?: unknown }).event === "string" &&
    ["mail_received", "mail_sent", "mail_moved"].includes(
      (p as { event: string }).event,
    )
  );
}

export function isMessagingWebhook(p: unknown): p is UnipileMessagingWebhook {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as { event?: unknown }).event === "string" &&
    ["message_received", "message_read", "message_reaction"].includes(
      (p as { event: string }).event,
    )
  );
}

export function isHostedAuthNotify(p: unknown): p is UnipileHostedAuthNotify {
  return (
    typeof p === "object" &&
    p !== null &&
    ((p as { status?: unknown }).status === "CREATION_SUCCESS" ||
      (p as { status?: unknown }).status === "RECONNECTED") &&
    typeof (p as { account_id?: unknown }).account_id === "string" &&
    typeof (p as { name?: unknown }).name === "string"
  );
}
