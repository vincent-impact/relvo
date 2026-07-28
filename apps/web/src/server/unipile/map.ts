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
 * Retire le fil cité d'une réponse email. Les clients (Apple Mail, Gmail,
 * Outlook…) recopient l'historique sous une ligne d'attribution — « Le … a
 * écrit : », « On … wrote: », « -----Message d'origine----- » — suivie de lignes
 * préfixées « > ». On ne veut afficher QUE la nouvelle réponse dans Relvo.
 *
 * ⚠️ On ne peut PAS se fier au seul début de ligne : selon le client (et surtout
 * après aplatissement du HTML → texte), l'attribution et les chevrons se
 * retrouvent AU MILIEU d'une ligne (« … tu veux bien. > Le 27 juil. 2026 à
 * 23:15, x@y a écrit : > > Merci… »). On coupe donc INLINE à la première
 * attribution rencontrée (ancrage fiable : un mot déclencheur + une date/heure +
 * « a écrit : »/« wrote: »/« escribió: »), puis on retombe sur le découpage par
 * ligne pour les cas normaux. Best-effort, multilingue.
 */
function stripQuotedReply(text: string): string {
  let t = text;

  // 1) Coupe INLINE à la ligne d'attribution (tolère les newlines aplaties).
  //    « Le <…date…> a écrit : » / « On <…date…> wrote: » / « El <…> escribió: ».
  //    ⚠️ Le déclencheur (le/on/el) DOIT être précédé d'un saut de ligne ou d'un
  //    chevron « > » : en français « On » et « Le » sont trop courants pour
  //    ancrer sur une simple espace (« On va faire LE test… » n'est pas une
  //    citation). Le \d exigé entre le déclencheur et le verbe écarte en plus la
  //    prose (« Le rapport que Marie a écrit : » n'a ni chevron ni date).
  const inlineAttribution =
    /(?:\n|>)\s*(?:le|on|el)\s[^\n]*?\d[^\n]*?(?:a\s+écrit|wrote|escribió)\s*:/i;
  const mAttr = inlineAttribution.exec(t);
  if (mAttr) t = t.slice(0, mAttr.index);

  // 2) Séparateurs explicites (transferts, Outlook).
  const separator =
    /(?:^|\n)\s*(?:-{2,}\s*(?:message d'origine|original message|forwarded message)|_{5,})/i;
  const mSep = separator.exec(t);
  if (mSep) t = t.slice(0, mSep.index);

  // 3) Cas normal : lignes citées « > » présentes en début de ligne.
  const kept: string[] = [];
  for (const line of t.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) break;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*>+\s*$/, "") // chevrons résiduels devant l'attribution coupée
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
    // Après aplatissement, l'attribution/les chevrons deviennent inline : la
    // même passe que le texte brut les retire (les blockquotes n'attrapent pas
    // les citations Apple Mail, qui n'en utilisent pas toujours).
    return stripQuotedReply(text) || null;
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
  // Destinataires To+Cc (M6quater) : forment le SET de la conversation avec
  // l'expéditeur. Le Bcc est exclu (invisible côté entrant, hors identité).
  const recipients = [
    ...(mail.to_attendees ?? []),
    ...(mail.cc_attendees ?? []),
  ]
    .map((a) => a?.identifier)
    .filter((id): id is string => Boolean(id));
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
    recipients,
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
