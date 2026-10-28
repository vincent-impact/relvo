import type {
  IngestInboundEmailInput,
  IngestInboundWhatsAppInput,
  IngestOutboundEmailInput,
} from "@relvo/db";
import { htmlFidele, texteLisible } from "@/server/courrier/corps";
import type {
  UnipileMailApi,
  UnipileMailWebhook,
  UnipileMessagingWebhook,
} from "./types";

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

/** Corps lisible et HTML fidèle : l'hygiène de la frontière (`courrier/corps.ts`), la même pour tous. */
function plainContent(mail: UnipileMailWebhook): string | null {
  return texteLisible({ plain: mail.body_plain, html: mail.body });
}

function htmlContent(mail: UnipileMailWebhook): string | null {
  return htmlFidele(mail.body);
}

/**
 * Convertit un `mail_received` en entrée `ingestInboundEmail`. `senderRaw` porte
 * l'adresse email brute (cf. modèle : « L'information brute de l'expéditeur
 * (adresse email ou numéro) »). `channelId` provient de la résolution du tenant
 * (ChannelConfig.externalAccountId → Channel), pas du payload.
 */
/**
 * Un e-mail lu par l'API (rattrapage, M7.19) prend la forme du webhook pour
 * passer par la même conversion : même hygiène, mêmes destinataires, même
 * idempotence sur `email_id`. Le corps HTML vit dans `body`, le texte dans
 * `body_plain` — comme dans le webhook.
 */
/**
 * Une ligne de liste suffit-elle, ou faut-il relire l'e-mail entier ? Il le
 * faut quand le corps manque, et quand l'e-mail DIT avoir des pièces jointes
 * sans les lister : la liste porte `has_attachments` sur toutes ses formes,
 * mais le détail des pièces ne vient sûrement qu'à l'unité. Sans ça, un devis
 * en PDF passait inaperçu (recette du 2026-10-21).
 */
export function doitRelireEmail(
  item: Pick<
    UnipileMailApi,
    "kind" | "body" | "body_plain" | "has_attachments" | "attachments"
  >,
): boolean {
  const corpsAbsent = item.kind !== "2_full" && !(item.body ?? item.body_plain);
  const piecesNonListees =
    item.has_attachments === true && !(item.attachments?.length ?? 0);
  return corpsAbsent || piecesNonListees;
}

export function apiMailToWebhook(mail: UnipileMailApi): UnipileMailWebhook {
  return {
    event: "mail_received",
    account_id: mail.account_id,
    email_id: mail.id,
    provider_id: mail.provider_id ?? null,
    in_reply_to: mail.in_reply_to ?? null,
    from_attendee: mail.from_attendee ?? null,
    to_attendees: mail.to_attendees ?? null,
    cc_attendees: mail.cc_attendees ?? null,
    subject: mail.subject ?? null,
    body: mail.body ?? null,
    body_plain: mail.body_plain ?? null,
    date: mail.date ?? null,
    has_attachments: mail.has_attachments ?? null,
    attachments: mail.attachments ?? null,
  };
}

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

export type NatureDuCourrier = "recu" | "envoye" | "brouillon" | "ecarte";

/**
 * Ce qu'un webhook de courrier porte VRAIMENT — l'événement ne suffit pas.
 * Gmail enregistre un brouillon à chaque pause de frappe, et chacun arrive en
 * `mail_received` : sans ce tri, un e-mail en cours d'écriture entrait en
 * quatre messages « reçus » de soi-même, dans le sujet, relus quatre fois.
 *
 *   - `brouillon` : rôle ou dossier de brouillons — jamais rangé, jamais lu ;
 *   - `ecarte`    : indésirable ou corbeille — ce que la boîte a déjà écarté ;
 *   - `envoye`    : `mail_sent`, ou un courrier du dossier des envoyés, ou un
 *                   courrier qui vient de l'une de NOS adresses hors de la boîte
 *                   de réception — c'est un envoi, d'où qu'il parte ;
 *   - `recu`      : le reste.
 */
export function natureDuCourrier(
  mail: UnipileMailWebhook,
  nosAdresses: readonly (string | null | undefined)[],
): NatureDuCourrier {
  const role = (mail.role ?? "").trim().toLowerCase();
  const dossiers = (mail.folders ?? []).map((f) => f.toLowerCase());
  const dansUnDossier = (motif: RegExp) => dossiers.some((f) => motif.test(f));
  if (
    role === "drafts" ||
    role === "draft" ||
    dansUnDossier(/draft|brouillon/)
  ) {
    return "brouillon";
  }
  if (
    role === "spam" ||
    role === "trash" ||
    dansUnDossier(/spam|junk|trash|corbeille|ind[ée]sirable/)
  ) {
    return "ecarte";
  }
  if (mail.event === "mail_sent" || role === "sent") return "envoye";
  const expediteur = mail.from_attendee?.identifier?.trim().toLowerCase();
  const nous = new Set(
    nosAdresses
      .filter((a): a is string => Boolean(a))
      .map((a) => a.trim().toLowerCase()),
  );
  if (expediteur && nous.has(expediteur) && role !== "inbox") return "envoye";
  return "recu";
}

/**
 * Convertit un `mail_sent` — un e-mail que le dirigeant a envoyé depuis un
 * client de messagerie, ou l'écho d'un envoi depuis Relvo — en entrée
 * `ingestOutboundEmail`. Les destinataires To puis Cc, dans cet ordre : le
 * premier To est l'interlocuteur ; l'ensemble forme le set de la conversation.
 */
export function toOutboundEmail(
  mail: UnipileMailWebhook,
  channelId: string,
): IngestOutboundEmailInput {
  const sentAt = mail.date ? new Date(mail.date) : null;
  const recipients = [
    ...(mail.to_attendees ?? []),
    ...(mail.cc_attendees ?? []),
  ]
    .map((a) => a?.identifier)
    .filter((id): id is string => Boolean(id));
  return {
    channelId,
    externalId: mail.email_id,
    trackingId: mail.tracking_id ?? null,
    origin: mail.origin ?? null,
    externalThreadId: threadHint(mail.in_reply_to),
    recipients,
    subjectLine: mail.subject ?? null,
    content: plainContent(mail),
    contentHtml: htmlContent(mail),
    sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
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

/**
 * En-têtes de l'e-mail, clés en minuscules, SI le webhook les porte — sous
 * forme d'objet `{ nom: valeur }` ou de liste `[{ name, value }]`. Le webhook
 * `mail_received` observé n'en expose aucun : le filtre déterministe du bruit
 * (M7) fonctionne sans, et les lira le jour où ils arrivent.
 */
export function toEmailHeaders(
  mail: UnipileMailWebhook,
): Record<string, string> | undefined {
  const raw = (mail as { headers?: unknown }).headers;
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  const poser = (nom: unknown, valeur: unknown) => {
    if (typeof nom !== "string" || !nom) return;
    const v = Array.isArray(valeur)
      ? valeur.filter((x): x is string => typeof x === "string").join(", ")
      : typeof valeur === "string"
        ? valeur
        : null;
    if (v) out[nom.toLowerCase()] = v;
  };
  if (Array.isArray(raw)) {
    for (const h of raw) {
      if (h && typeof h === "object") {
        const { name, value } = h as { name?: unknown; value?: unknown };
        poser(name, value);
      }
    }
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      poser(k, v);
    }
  }
  return Object.keys(out).length ? out : undefined;
}
