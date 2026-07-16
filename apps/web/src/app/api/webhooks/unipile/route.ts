import { ingestInboundEmail } from "@relvo/db";
import {
  buildObjectKey,
  MAX_FILE_SIZE_BYTES,
  getStorage,
} from "@relvo/storage";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { createAttachment } from "@relvo/db";
import { toInboundEmail } from "@/server/unipile/map";
import {
  UNIPILE_AUTH_HEADER,
  verifyWebhookAuth,
} from "@/server/unipile/signature";
import {
  fetchAttachment,
  getAccount,
  type UnipileAccountStatusWebhook,
  type UnipileHostedAuthNotify,
  type UnipileMailWebhook,
  isHostedAuthNotify,
  isMailWebhook,
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

  // 3) Changement d'état d'un compte connecté (déconnexion, reauth requise).
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

  // Récupère l'adresse réelle (le webhook ne la porte pas) pour l'afficher.
  const account = await getAccount(notify.account_id);
  const email = account?.email ?? null;
  if (email) {
    await prisma.channel.updateMany({
      where: { id: channelId },
      data: { identifier: email, name: email },
    });
  }

  return ok({ ok: true, channelId, status: "connected", email });
}

async function handleAccountStatus(evt: UnipileAccountStatusWebhook) {
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: evt.account_id },
    select: { channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  const raw = (evt.status ?? "").toUpperCase();
  const connected =
    raw === "OK" || raw === "CONNECTED" || raw === "CREATION_SUCCESS";
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

  // Ingestion idempotente → Message orphelin (« Sans sujet »).
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

  return ok({ ok: true, messageId: message.id, created, attachments: stored });
}
