import type {
  IngestInboundEmailInput,
  IngestInboundWhatsAppInput,
} from "@relvo/db";
import type { UnipileMailWebhook, UnipileMessagingWebhook } from "./types";

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

/**
 * Retire le fil cité d'une réponse email (texte brut). Les clients (Gmail,
 * Outlook…) recopient l'historique sous une ligne d'attribution — « Le … a
 * écrit : », « On … wrote: », « -----Message d'origine----- » — suivie de lignes
 * préfixées « > ». On ne veut afficher QUE la nouvelle réponse dans Relvo, donc
 * on coupe à la première marque de citation. Best-effort, multilingue.
 */
function stripQuotedReply(text: string): string {
  const attribution =
    /^\s*(le\s.+\sa\s+écrit\s*:|on\s.+\bwrote:\s*$|el\s.+\sescribió:|-{2,}\s*(message d'origine|original message|forwarded message)|_{5,}|de\s*:\s.+\benvoyé\s*:)/i;
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (attribution.test(line)) break; // début du bloc cité → on coupe
    if (/^\s*>/.test(line)) break; // lignes citées → on coupe
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Corps lisible : on privilégie le texte brut (nettoyé du fil cité), sinon on
 *  dé-balise le HTML après avoir retiré les blocs de citation. */
function plainContent(mail: UnipileMailWebhook): string | null {
  if (mail.body_plain?.trim()) {
    return stripQuotedReply(mail.body_plain) || null;
  }
  if (mail.body?.trim()) {
    const text = mail.body
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      // Blocs cités Gmail/Outlook retirés AVANT le dé-balisage.
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ")
      .replace(/<div[^>]*gmail_quote[\s\S]*?<\/div>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }
  return null;
}

/**
 * Corps HTML d'origine, conservé pour un rendu FIDÈLE (l'iframe isolé s'occupe de
 * l'isolation CSS et bloque le JS). On retire tout de même les `<script>` par
 * ceinture-bretelles. Null si l'e-mail n'a pas de partie HTML.
 */
function htmlContent(mail: UnipileMailWebhook): string | null {
  if (!mail.body?.trim()) return null;
  const html = mail.body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  return html || null;
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
    // Nom d'affichage email (« Karim Benali <karim@…> ») quand le client le donne.
    senderName: mail.from_attendee?.display_name ?? null,
    subjectLine: mail.subject ?? null,
    content: plainContent(mail),
    contentHtml: htmlContent(mail),
    receivedAt:
      receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
  };
}

/**
 * Identifiant brut de l'expéditeur WhatsApp. On PRIVILÉGIE le numéro de téléphone
 * (humain, stable, matchable avec `Contact.phone`) au LID opaque (`…@lid`), qui
 * n'a de sens pour personne. Ordre : `attendee_specifics.phone_number` →
 * `attendee_public_identifier` dé-suffixé de `@s.whatsapp.net` → LID en dernier
 * recours. Formes confirmées contre le webhook prod.
 */
function whatsAppSenderRaw(evt: UnipileMessagingWebhook): string | null {
  const s = evt.sender;
  if (!s) return null;
  const phone = s.attendee_specifics?.phone_number?.trim();
  if (phone) return phone;
  const publicId = s.attendee_public_identifier?.trim();
  if (publicId) return publicId.replace(/@s\.whatsapp\.net$/i, "");
  const lid = (s.attendee_provider_id ?? s.provider_id)?.trim();
  return lid || null;
}

/** Coerce l'horodatage Unipile (ISO string ou epoch) en `Date` valide, sinon null. */
function messagingReceivedAt(
  ts: string | number | null | undefined,
): Date | null {
  if (ts == null) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convertit un `message_received` (WhatsApp via Unipile) en entrée
 * `ingestInboundWhatsApp`. `externalThreadId` porte le `chat_id` (fil = clé de
 * rattachement et de réponse) ; `senderRaw` le numéro brut ; pas de `subjectLine`
 * (WhatsApp n'a pas d'objet). `channelId` vient de la résolution du tenant, pas
 * du payload.
 */
export function toInboundWhatsApp(
  evt: UnipileMessagingWebhook,
  channelId: string,
): IngestInboundWhatsAppInput {
  const content = evt.message?.trim() ? evt.message.trim() : null;
  const profileName = evt.sender?.attendee_name?.trim() || null;
  return {
    channelId,
    externalId: evt.message_id ?? "",
    externalThreadId: evt.chat_id ?? null,
    senderRaw: whatsAppSenderRaw(evt),
    // Nom de profil WhatsApp (« Leroy Frederique ») → label lisible avant contact.
    senderName: profileName,
    // Groupe → 1 groupe = 1 sujet, réponse à Tous (composer fiche sujet).
    isGroup: evt.is_group ?? false,
    content,
    receivedAt: messagingReceivedAt(evt.timestamp),
  };
}
