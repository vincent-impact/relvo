import { ingestInboundEmail, ingestInboundWhatsApp } from "@relvo/db";
import {
  buildObjectKey,
  MAX_FILE_SIZE_BYTES,
  getStorage,
} from "@relvo/storage";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { expireTenantData } from "@/server/cached";
import { createAttachment } from "@relvo/db";
import { toInboundEmail, toInboundWhatsApp } from "@/server/unipile/map";
import {
  UNIPILE_AUTH_HEADER,
  verifyWebhookAuth,
} from "@/server/unipile/signature";
import {
  fetchAttachment,
  fetchMessageAttachment,
  getAccount,
  type UnipileAccountStatusWebhook,
  type UnipileHostedAuthNotify,
  type UnipileMailWebhook,
  type UnipileMessagingWebhook,
  isHostedAuthNotify,
  isMailWebhook,
  isMessagingWebhook,
  unipileChatDirectory,
} from "@/server/unipile";

// Webhook unique du fournisseur d'intégration Unipile (M5.2/M5.3/M5.4/M5.8).
//
// Point d'entrée NON authentifié par cookie : Unipile s'authentifie via le
// header secret `Unipile-Auth`. On résout ensuite le tenant depuis le compte
// Unipile (ChannelConfig.externalAccountId), avec un accès Prisma HORS tenant —
// même schéma que le cron M4.6.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Défense en profondeur : une route qui touche de la donnée tenant ne doit
// jamais être mise en cache CDN (clé = méthode+URL, identique pour tous).
const NO_STORE = {
  "Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

function ok(body: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(body, { headers: NO_STORE });
}

export async function POST(request: Request) {
  // Webhooks managés → header `Unipile-Auth` ; callback notify_url → `?secret=`.
  const queryToken = new URL(request.url).searchParams.get("secret");
  if (
    !verifyWebhookAuth(request.headers.get(UNIPILE_AUTH_HEADER), queryToken)
  ) {
    return NextResponse.json(
      { error: "Non autorisé." },
      { status: 401, headers: NO_STORE },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400, headers: NO_STORE },
    );
  }

  // 1) Fin de hosted auth : relier le compte Unipile fraîchement connecté au
  //    Channel pré-créé (`name` = notre channelId).
  if (isHostedAuthNotify(payload)) {
    return handleHostedAuthNotify(payload);
  }

  // 2) Email entrant/sortant.
  if (isMailWebhook(payload)) {
    if (payload.event === "mail_received") return handleMailReceived(payload);
    // `mail_sent` / `mail_moved` : rien à faire en V1 (nos envois sont déjà
    // journalisés côté Server Action ; l'auto-cochage des réponses est M7).
    return ok({ ok: true, ignored: payload.event });
  }

  // 3) Messagerie (WhatsApp) entrante.
  if (isMessagingWebhook(payload)) {
    if (payload.event === "message_received") {
      return handleMessageReceived(payload);
    }
    // `message_read` / `message_reaction` : rien à faire en V1.
    return ok({ ok: true, ignored: payload.event });
  }

  // 4) Changement d'état d'un compte connecté (déconnexion, reauth requise).
  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as UnipileAccountStatusWebhook).account_id === "string"
  ) {
    return handleAccountStatus(payload as UnipileAccountStatusWebhook);
  }

  return ok({ ok: true, ignored: "unknown_event" });
}

async function handleHostedAuthNotify(notify: UnipileHostedAuthNotify) {
  const channelId = notify.name;
  // Lookup hors tenant : le channelId (uuid) est globalement unique.
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, accountId: true },
  });
  if (!channel) return ok({ ok: true, ignored: "unknown_channel" });

  // On relie le compte Unipile et on marque le canal connecté. Écriture infra
  // scopée par channelId (unique) — pas de fuite tenant possible.
  await prisma.channelConfig.updateMany({
    where: { channelId },
    data: {
      externalAccountId: notify.account_id,
      status: "connected",
      lastSyncAt: new Date(),
    },
  });

  // Récupère l'identité réelle (le webhook ne la porte pas) pour l'afficher :
  // adresse email pour une boîte mail, numéro pour WhatsApp.
  const account = await getAccount(notify.account_id);
  const identifier = account?.identifier ?? null;
  if (identifier) {
    await prisma.channel.updateMany({
      where: { id: channelId },
      data: { identifier, name: identifier },
    });
  }

  return ok({ ok: true, channelId, status: "connected", identifier });
}

async function handleAccountStatus(evt: UnipileAccountStatusWebhook) {
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: evt.account_id },
    select: { channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  // Unipile ne type pas fortement ce payload : le libellé d'état peut arriver
  // sous `status` ou `message` (OK / CREDENTIALS / DISCONNECTED / SYNC_SUCCESS…).
  const raw = (evt.status ?? evt.message ?? "").toUpperCase();
  const connected =
    raw === "OK" ||
    raw === "CONNECTED" ||
    raw === "CREATION_SUCCESS" ||
    raw === "SYNC_SUCCESS" ||
    raw === "RECONNECTED";
  await prisma.channelConfig.updateMany({
    where: { channelId: config.channelId },
    data: {
      status: connected ? "connected" : "error",
      lastSyncAt: new Date(),
    },
  });
  return ok({ ok: true, status: connected ? "connected" : "error" });
}

async function handleMailReceived(mail: UnipileMailWebhook) {
  // Résolution du tenant depuis le compte Unipile.
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: mail.account_id },
    select: { accountId: true, channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  const db = tenantDb(config.accountId);

  // Ingestion idempotente → Message rangé dans sa conversation (M6bis), rattaché
  // au sujet si une fenêtre y est ouverte, « Sans sujet » sinon.
  const { message, created } = await ingestInboundEmail(
    db,
    toInboundEmail(mail, config.channelId),
  );

  // Pièces jointes (M5.4) : seulement au premier passage (idempotence). Le
  // fichier vit dans R2 (source de vérité) ; Unipile n'est qu'un transport.
  let stored = 0;
  if (created && mail.attachments?.length) {
    const storage = getStorage();
    for (const att of mail.attachments) {
      try {
        const { bytes, contentType } = await fetchAttachment({
          accountId: mail.account_id,
          emailId: mail.email_id,
          attachmentId: att.id,
        });
        if (bytes.byteLength > MAX_FILE_SIZE_BYTES.attachments) continue; // garde-fou taille
        const key = buildObjectKey({
          accountId: config.accountId,
          scope: "attachments",
        });
        const mime = contentType ?? att.mime ?? att.content_type ?? null;
        await storage.put({
          key,
          body: bytes,
          contentType: mime ?? "application/octet-stream",
        });
        await createAttachment(db, {
          messageId: message.id,
          // Si le message a été rattaché à un sujet (règle interlocuteur+objet),
          // la PJ hérite du subjectId → elle apparaît dans la box « Pièces
          // jointes » de la fiche (qui liste par subjectId).
          subjectId: message.subjectId,
          name: att.name ?? "piece-jointe",
          mimeType: mime,
          storageKey: key,
          fileSize: bytes.byteLength,
        });
        stored += 1;
      } catch (err) {
        // Une PJ ratée ne doit pas faire échouer l'ingestion du message.
        console.error("[unipile] pièce jointe non stockée", att.id, err);
      }
    }
  }

  // Nouveau message → purge le Data Cache du tenant, sinon les KPI/fil (servis
  // depuis `unstable_cache`) resteraient périmés jusqu'au revalidate 120 s et le
  // polling client (router.refresh) relirait le cache sans rien voir.
  if (created) expireTenantData();

  return ok({ ok: true, messageId: message.id, created, attachments: stored });
}

// Nom de fichier lisible pour un média WhatsApp (le webhook n'en fournit aucun).
// Dérivé du `attachment_type` ; l'extension exacte suivra le MIME du Blob.
function whatsAppMediaName(type: string | null | undefined): string {
  switch ((type ?? "").toLowerCase()) {
    case "img":
    case "image":
      return "photo";
    case "video":
      return "vidéo";
    case "audio":
    case "voice":
      return "message vocal";
    default:
      return "piece-jointe";
  }
}

async function handleMessageReceived(evt: UnipileMessagingWebhook) {
  // Anti-loop : un message ENVOYÉ par le compte connecté (nous, ou l'utilisateur
  // depuis son propre téléphone) revient en `message_received` avec
  // `is_sender: true`. Nos envois sont déjà journalisés par sendWhatsAppReply →
  // on ignore l'écho (plus robuste que l'idempotence seule).
  if (evt.is_sender) {
    return ok({ ok: true, ignored: "own_message" });
  }

  // Données minimales requises pour l'ingestion idempotente + le rattachement.
  if (!evt.account_id || !evt.message_id) {
    return ok({ ok: true, ignored: "incomplete_message" });
  }

  // Résolution du tenant depuis le compte Unipile.
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: evt.account_id },
    select: { accountId: true, channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  const db = tenantDb(config.accountId);

  // Ingestion idempotente → Message rangé dans sa conversation (M6bis, clé
  // `chat_id` en groupe), rattaché au sujet si une fenêtre y est ouverte.
  // Anti-loop : nos envois ont déjà posé un Message
  // sortant avec `externalId = message_id` → l'écho d'un message que NOUS avons
  // envoyé retombe sur l'idempotence (findFirst → created:false), aucun doublon.
  // 3e argument (M6bis.7) : l'annuaire de fils. Il sert à nommer un groupe et à
  // trancher son type d'après `Chat.type` (autoritaire) plutôt que d'après le
  // `is_group` du webhook. Le domaine ne l'interroge qu'à la découverte d'un fil,
  // ou tant qu'un groupe s'appelle encore « Groupe WhatsApp » — jamais à chaque
  // message.
  const { message, created } = await ingestInboundWhatsApp(
    db,
    toInboundWhatsApp(evt, config.channelId),
    unipileChatDirectory,
  );

  // Médias (M6.6) : même chemin que les PJ email — seulement au premier passage.
  // Le webhook messaging n'expose ni nom ni MIME : l'id de PJ est `attachment_id`
  // (⚠️ pas `id`), le MIME vient du Blob récupéré, le nom est dérivé du type.
  let stored = 0;
  if (created && evt.attachments?.length) {
    const storage = getStorage();
    for (const att of evt.attachments) {
      try {
        const { bytes, contentType } = await fetchMessageAttachment({
          messageId: evt.message_id,
          attachmentId: att.attachment_id,
        });
        if (bytes.byteLength > MAX_FILE_SIZE_BYTES.attachments) continue; // garde-fou taille
        const key = buildObjectKey({
          accountId: config.accountId,
          scope: "attachments",
        });
        const mime = contentType ?? null;
        await storage.put({
          key,
          body: bytes,
          contentType: mime ?? "application/octet-stream",
        });
        await createAttachment(db, {
          messageId: message.id,
          subjectId: message.subjectId,
          name: whatsAppMediaName(att.attachment_type),
          mimeType: mime,
          storageKey: key,
          fileSize: bytes.byteLength,
        });
        stored += 1;
      } catch (err) {
        console.error(
          "[unipile] média WhatsApp non stocké",
          att.attachment_id,
          err,
        );
      }
    }
  }

  if (created) expireTenantData();

  return ok({ ok: true, messageId: message.id, created, attachments: stored });
}
