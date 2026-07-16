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
  /** Id du message parent (réponse à) — signal de fil faible pour M7. */
  in_reply_to?: string | null;
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
