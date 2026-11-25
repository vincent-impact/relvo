import type {
  IdentiteNotee,
  IngestInboundEmailInput,
  IngestInboundWhatsAppInput,
  IngestOutboundEmailInput,
  IngestOutboundWhatsAppInput,
} from "@relvo/db";
import {
  VIGNETTE_MAX_CARACTERES,
  familleDeMedia,
  type FamilleDeMedia,
  type PieceDeMessagerie,
} from "@/lib/medias";
import { htmlFidele, texteLisible } from "@/server/courrier/corps";
import type {
  UnipileChatAttendeeApi,
  UnipileChatMessageApi,
  UnipileMailApi,
  UnipileMailWebhook,
  UnipileMessageApi,
  UnipileMessagingAttachmentRef,
  UnipileMessagingAttendee,
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

/** Le numéro d'un participant, comme le webhook le donne pour un expéditeur. */
function numeroDuParticipant(a: UnipileChatAttendeeApi): string | null {
  const phone = a.specifics?.phone_number?.trim();
  if (phone) return phone;
  const publicId = a.public_identifier?.trim();
  if (publicId) return publicId.replace(/@s\.whatsapp\.net$/i, "");
  return null;
}

/** L'annuaire d'un fil : identifiant interne → numéro et nom. */
export function annuaireDuFil(
  participants: readonly UnipileChatAttendeeApi[],
): Map<string, { numero: string | null; nom: string | null }> {
  const annuaire = new Map<
    string,
    { numero: string | null; nom: string | null }
  >();
  for (const p of participants) {
    const id = (p.provider_id ?? p.specifics?.lid)?.trim();
    if (!id) continue;
    annuaire.set(id, {
      numero: numeroDuParticipant(p),
      nom: p.name?.trim() || null,
    });
  }
  return annuaire;
}

export type MessageRelu =
  | { sens: "recu"; entrant: IngestInboundWhatsAppInput }
  | { sens: "envoye"; sortant: IngestOutboundWhatsAppInput }
  | { sens: "laisse"; motif: "evenement" | "sans-texte" | "sans-expediteur" };

/**
 * Un message RELU dans la liste d'un fil (M25.10) → l'entrée du domaine. Le
 * texte seul revient : un message qui n'en porte pas (une photo, un vocal) est
 * laissé, et compté comme non retrouvé. Dans un fil direct, l'expéditeur est
 * l'interlocuteur de la conversation ; dans un groupe, l'annuaire du fil
 * traduit l'identifiant interne en numéro — sans lui, le message est laissé
 * plutôt que rangé sous un identifiant que personne ne sait lire.
 */
export function messageRelu(
  item: UnipileChatMessageApi,
  fil: {
    channelId: string;
    chatId: string;
    groupe: boolean;
    /** Fil direct : le numéro de l'interlocuteur, tel que la conversation le porte. */
    interlocuteur: string | null;
    annuaire: ReadonlyMap<
      string,
      { numero: string | null; nom: string | null }
    >;
  },
): MessageRelu {
  if (item.is_event) return { sens: "laisse", motif: "evenement" };
  const content = item.text?.trim() ? item.text.trim() : null;
  if (!content) return { sens: "laisse", motif: "sans-texte" };
  const quand = messagingReceivedAt(item.timestamp);
  if (item.is_sender) {
    return {
      sens: "envoye",
      sortant: {
        channelId: fil.channelId,
        externalId: item.id,
        externalThreadId: fil.chatId,
        content,
        sentAt: quand,
      },
    };
  }
  const connu = item.sender_id ? fil.annuaire.get(item.sender_id) : undefined;
  const senderRaw = fil.groupe ? (connu?.numero ?? null) : fil.interlocuteur;
  if (!senderRaw) return { sens: "laisse", motif: "sans-expediteur" };
  return {
    sens: "recu",
    entrant: {
      channelId: fil.channelId,
      externalId: item.id,
      externalThreadId: fil.chatId,
      senderRaw,
      senderName: connu?.nom ?? null,
      isGroup: fil.groupe,
      content,
      receivedAt: quand,
    },
  };
}

// ── L'annuaire des identifiants (M29.1) ─────────────────────────────────────
// Ce que l'agrégateur dit de quelqu'un, tel que l'annuaire le note.

/** L'auteur d'un webhook de messagerie, tel que l'annuaire le note. */
export function identiteDuWebhook(
  s: UnipileMessagingAttendee | null | undefined,
  opts: { isSelf?: boolean } = {},
): IdentiteNotee[] {
  if (!s) return [];
  return [
    {
      internalId:
        s.attendee_provider_id ?? s.provider_id ?? s.attendee_specifics?.lid,
      phone: s.attendee_specifics?.phone_number ?? s.attendee_public_identifier,
      name: s.attendee_name,
      isSelf: opts.isSelf,
    },
  ];
}

/** Un participant d'un fil, tel que l'annuaire le note. */
export function identiteDuParticipant(
  p: UnipileChatAttendeeApi,
): IdentiteNotee {
  return {
    internalId: p.provider_id ?? p.specifics?.lid,
    phone: p.specifics?.phone_number ?? p.public_identifier,
    name: p.name,
    isSelf: Boolean(p.is_self),
  };
}

// ── Les pièces d'un message, décrites avant d'être lues (M25.3) ─────────────
// Ce que l'agrégateur dit d'une pièce — son type, son poids, si c'est un
// autocollant, un GIF, un vocal — et la vignette que le réseau joint au
// message : de quoi décider (`lib/medias.ts`) sans télécharger un octet.

/** Le type que l'agrégateur donne à une pièce → sa famille et son type MIME par défaut. */
const PAR_TYPE: Record<string, { famille: FamilleDeMedia; mime: string }> = {
  img: { famille: "image", mime: "image/jpeg" },
  image: { famille: "image", mime: "image/jpeg" },
  video: { famille: "video", mime: "video/mp4" },
  audio: { famille: "audio", mime: "audio/ogg" },
  voice: { famille: "audio", mime: "audio/ogg" },
};

function nomDePiece(p: {
  famille: FamilleDeMedia;
  autocollant: boolean;
  gif: boolean;
  vocal: boolean;
  fichier?: string | null;
}): string {
  if (p.autocollant) return "autocollant";
  if (p.gif) return "GIF";
  const fichier = p.fichier?.trim();
  if (fichier) return fichier.slice(0, 500);
  switch (p.famille) {
    case "image":
      return "photo";
    case "video":
      return "vidéo";
    case "audio":
      return p.vocal ? "message vocal" : "audio";
    default:
      return "piece-jointe";
  }
}

/**
 * La vignette que le réseau joint à un message — un JPEG de quelques
 * kilo-octets, en base64, sous la clé `jpegThumbnail` du message brut, à une
 * profondeur qui dépend de ce que le message est (image, vidéo, document,
 * message éphémère…). On la cherche où qu'elle soit ; rien d'autre du brut
 * n'est lu. `null` si elle manque, n'est pas un JPEG, ou pèse trop.
 */
export function vignetteDepuisOriginal(original: unknown): string | null {
  let brut: unknown = original;
  if (typeof original === "string") {
    try {
      brut = JSON.parse(original);
    } catch {
      return null;
    }
  }
  const chercher = (v: unknown, profondeur: number): string | null => {
    if (!v || typeof v !== "object" || profondeur > 8) return null;
    for (const [cle, valeur] of Object.entries(v)) {
      if (cle === "jpegThumbnail" && typeof valeur === "string") {
        const propre = valeur.trim();
        return propre.startsWith("/9j/") &&
          propre.length <= VIGNETTE_MAX_CARACTERES &&
          /^[A-Za-z0-9+/]+=*$/.test(propre)
          ? propre
          : null;
      }
      const trouve = chercher(valeur, profondeur + 1);
      if (trouve) return trouve;
    }
    return null;
  };
  return chercher(brut, 0);
}

/**
 * Les pièces d'un message, telles que Relvo en décide. `message` est le
 * message relu à l'unité chez l'agrégateur — la description riche ; s'il
 * manque (agrégateur muet), on se rabat sur ce que le webhook portait : le
 * type et le poids, sans autocollant ni vignette.
 */
export function piecesDuMessage(
  message: UnipileMessageApi | null,
  webhook: readonly UnipileMessagingAttachmentRef[] = [],
): PieceDeMessagerie[] {
  const decrites = message?.attachments ?? [];
  if (decrites.length === 0) {
    return webhook
      .filter((a) => a.attachment_id)
      .map((a) => {
        const type = PAR_TYPE[(a.attachment_type ?? "").toLowerCase()];
        const famille = type?.famille ?? "autre";
        return {
          id: a.attachment_id,
          famille,
          mime: type?.mime ?? null,
          nom: nomDePiece({
            famille,
            autocollant: false,
            gif: false,
            vocal: (a.attachment_type ?? "").toLowerCase() === "voice",
          }),
          taille: a.attachment_size ?? null,
          autocollant: false,
          gif: false,
          vocal: (a.attachment_type ?? "").toLowerCase() === "voice",
          vignette: null,
        };
      });
  }
  // La vignette est celle DU message : elle va à sa première image ou vidéo.
  let vignette = vignetteDepuisOriginal(message?.original);
  return decrites
    .filter((a) => a.id)
    .map((a) => {
      const type = PAR_TYPE[(a.type ?? "").toLowerCase()];
      const mime = a.mimetype?.trim() || type?.mime || null;
      // Un fichier dont le type dit « vidéo » est une vidéo, quel que soit le
      // geste qui l'a envoyé.
      const famille =
        a.mimetype?.trim() && familleDeMedia(a.mimetype) !== "autre"
          ? familleDeMedia(a.mimetype)
          : (type?.famille ?? "autre");
      const autocollant = Boolean(a.sticker);
      const gif = Boolean(a.gif);
      const vocal = Boolean(a.voice_note);
      const visuelle = famille === "image" || famille === "video";
      const laSienne = visuelle && !autocollant && !gif ? vignette : null;
      if (laSienne) vignette = null;
      return {
        id: a.id,
        famille,
        mime,
        nom: nomDePiece({
          famille,
          autocollant,
          gif,
          vocal,
          fichier: a.file_name,
        }),
        taille: a.file_size ?? null,
        autocollant,
        gif,
        vocal,
        vignette: laSienne,
      };
    });
}
