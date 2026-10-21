import {
  ensureOnboardingQuestions,
  getOpenCatchup,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  ingestOutboundEmail,
  ingestOutboundWhatsApp,
  requestChannelCatchup,
} from "@relvo/db";
import {
  buildObjectKey,
  MAX_FILE_SIZE_BYTES,
  getStorage,
} from "@relvo/storage";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { expireTenantData } from "@/server/cached";
import { createAttachment } from "@relvo/db";
import { lancerTranche } from "@/server/ia/pipeline/rattrapage";
import {
  estHistorique,
  fenetreDeRattrapage,
} from "@/server/ia/pipeline/rattrapage-regles";
import { relireApresSalve, relireSujet } from "@/server/ia/pipeline/relecture";
import { trierConversation } from "@/server/ia/pipeline/tri";
import { stockerPiecesJointes } from "@/server/unipile/attachments";
import {
  toEmailHeaders,
  toInboundEmail,
  toInboundWhatsApp,
  toOutboundEmail,
} from "@/server/unipile/map";
import {
  UNIPILE_AUTH_HEADER,
  verifyWebhookAuth,
} from "@/server/unipile/signature";
import {
  fetchMessageAttachment,
  getAccount,
  type UnipileAccountStatusWebhook,
  type UnipileHostedAuthNotify,
  type UnipileMailWebhook,
  type UnipileMessagingWebhook,
  isHostedAuthNotify,
  isMailWebhook,
  isMessagingWebhook,
  statutDepuisUnipile,
  unipileChatDirectory,
} from "@/server/unipile";
import { setChannelConfigStatus } from "@relvo/db";

// Webhook unique du fournisseur d'intégration Unipile (M5.2/M5.3/M5.4/M5.8).
//
// Point d'entrée NON authentifié par cookie : Unipile s'authentifie via le
// header secret `Unipile-Auth`. On résout ensuite le tenant depuis le compte
// Unipile (ChannelConfig.externalAccountId), avec un accès Prisma HORS tenant —
// même schéma que le cron M4.6.

export const dynamic = "force-dynamic";
// Le tri d'un fil WhatsApp direct attend la fin de la salve après la réponse
// (M7 tranche 11), puis trie et structure : le budget de la fonction le couvre.
export const maxDuration = 120;

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

  // 2) Email reçu, ou envoyé depuis un client de messagerie.
  if (isMailWebhook(payload)) {
    if (payload.event === "mail_received") return handleMailReceived(payload);
    if (payload.event === "mail_sent") return handleMailSent(payload);
    // `mail_moved` : rien à faire.
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
  //    Unipile l'enveloppe sous `AccountStatus` ; on accepte aussi la forme nue.
  const accountStatus = unwrapAccountStatus(payload);
  if (accountStatus) return handleAccountStatus(accountStatus);

  return ok({ ok: true, ignored: "unknown_event" });
}

async function handleHostedAuthNotify(notify: UnipileHostedAuthNotify) {
  const channelId = notify.name;
  // Lookup hors tenant : le channelId (uuid) est globalement unique.
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, accountId: true, type: true },
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

  // Le rattrapage du courrier récent (M7.19) : demandé à la connexion d'un
  // canal e-mail, et la PREMIÈRE TRANCHE part aussitôt — la route de tranche
  // répond 202 et travaille après sa réponse. Idempotent côté domaine — une
  // reconnexion ne redemande rien tant qu'un rattrapage est ouvert ; si le
  // lancement échoue, une page ou le filet relancera la ligne.
  if (channel.type === "email") {
    try {
      const db = tenantDb(channel.accountId);
      const catchup = await requestChannelCatchup(db, {
        channelId,
        since: fenetreDeRattrapage(),
      });
      // Le premier échange naît ICI (05 §11.11) : les étapes du script qui
      // restent à poser sont posées, le badge s'allume avant même que le
      // dirigeant n'ouvre l'échange ; le même script rejoue, plus court, à
      // chaque canal.
      await ensureOnboardingQuestions(db, channel.accountId);
      await lancerTranche(catchup.id);
    } catch (err) {
      console.error("[unipile] rattrapage non lancé", { channelId }, err);
    }
  }

  return ok({ ok: true, channelId, status: "connected", identifier });
}

function unwrapAccountStatus(
  payload: unknown,
): UnipileAccountStatusWebhook | null {
  if (typeof payload !== "object" || payload === null) return null;
  const inner =
    (payload as { AccountStatus?: unknown }).AccountStatus ?? payload;
  if (typeof inner !== "object" || inner === null) return null;
  return typeof (inner as UnipileAccountStatusWebhook).account_id === "string"
    ? (inner as UnipileAccountStatusWebhook)
    : null;
}

async function handleAccountStatus(evt: UnipileAccountStatusWebhook) {
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: evt.account_id },
    select: { accountId: true, channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  // Unipile ne type pas fortement ce payload : le libellé d'état peut arriver
  // sous `status` ou `message`. La traduction est la table partagée avec la
  // page Canaux (`statutDepuisUnipile`) ; un libellé inconnu ne change RIEN —
  // un statut deviné est pire qu'un statut inchangé (PITFALLS #53).
  const status = statutDepuisUnipile(evt.status ?? evt.message);
  if (!status) {
    console.warn("[unipile] état de compte inconnu", {
      accountId: evt.account_id,
      status: evt.status,
      message: evt.message,
    });
    return ok({ ok: true, ignored: "unknown_status" });
  }
  await setChannelConfigStatus(
    tenantDb(config.accountId),
    config.channelId,
    status,
    new Date(),
  );
  return ok({ ok: true, status });
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
  // Si le message a été rattaché à un sujet au rangement, la PJ en hérite.
  const stored =
    created && mail.attachments?.length
      ? await stockerPiecesJointes(db, {
          accountId: config.accountId,
          unipileAccountId: mail.account_id,
          emailId: mail.email_id,
          messageId: message.id,
          subjectId: message.subjectId,
          attachments: mail.attachments,
        })
      : 0;

  // Un message d'HISTORIQUE — synchronisé à la connexion, daté d'avant la
  // demande d'un rattrapage encore ouvert sur le canal — est rangé mais laissé
  // à la tranche en cours (M7.19) : il ne se trie pas plein tarif à la volée,
  // ni ne relit un sujet à contretemps. Sans rattrapage ouvert, ou daté
  // d'après la demande, c'est du courrier vivant : trié à réception.
  if (created) {
    const ouvert = await getOpenCatchup(db, config.channelId);
    if (ouvert && estHistorique(mail.date, ouvert.requestedAt)) {
      expireTenantData();
      return ok({ ok: true, messageId: message.id, historique: true, stored });
    }
  }

  // Nouveau message → purge le Data Cache du tenant, sinon les KPI/fil (servis
  // depuis `unstable_cache`) resteraient périmés jusqu'au revalidate 120 s et le
  // polling client (router.refresh) relirait le cache sans rien voir.
  if (created) expireTenantData();

  // Tri automatique (M7, tranche 4) — APRÈS la réponse HTTP, une fois par
  // message (`created`), et seulement si aucun sujet n'a capté le message au
  // rangement : sinon la conversation n'est pas orpheline et il n'y a rien à
  // trier. Le pipeline revérifie tout (assistant actif sur le compte, idempotence,
  // orphelinat) et n'échoue jamais vers l'appelant : un échec laisse la
  // conversation orpheline, journalisé.
  if (created && !message.subjectId) {
    const entetes = toEmailHeaders(mail);
    after(async () => {
      const resultat = await trierConversation({
        accountId: config.accountId,
        conversationId: message.conversationId,
        messageId: message.id,
        entetes,
      });
      console.info("[ia] tri", {
        accountId: config.accountId,
        messageId: message.id,
        ...resultat,
      });
    });
  }

  // Relecture (M7, tranche 6) — le message a été capté par un sujet au
  // rangement (écoute du fil, réouverture mécanique comprise) : Relvo relit
  // le sujet à sa lumière. Même discipline : après la réponse HTTP, une fois
  // par message, et un échec laisse le sujet tel qu'il était.
  if (created && message.subjectId) {
    const subjectId = message.subjectId;
    after(async () => {
      const resultat = await relireSujet({
        accountId: config.accountId,
        subjectId,
        messageId: message.id,
      });
      console.info("[ia] relecture", {
        accountId: config.accountId,
        messageId: message.id,
        ...resultat,
      });
    });
  }

  return ok({ ok: true, messageId: message.id, created, attachments: stored });
}

/**
 * Un e-mail ENVOYÉ par le compte connecté (M7 tranche 11, suite) : l'écho d'un
 * envoi fait depuis Relvo — en base sous sa référence de suivi, l'idempotence
 * l'arrête — ou un e-mail que le dirigeant a envoyé DEPUIS SON CLIENT DE
 * MESSAGERIE (Gmail, Outlook, le téléphone), qui entre comme un envoi : même
 * conversation, l'affaire qui l'écoute, la tâche de réponse cochée par
 * correspondance, puis la relecture — comme un envoi depuis Relvo (05 §4.1).
 * Tant que le dirigeant ne répond pas toujours depuis Relvo, ce qu'il envoie
 * d'ailleurs compte autant. Les pièces jointes d'un envoi ne sont pas
 * rapatriées : l'affaire se lit, elle ne stocke pas ce que le dirigeant a déjà.
 */
async function handleMailSent(mail: UnipileMailWebhook) {
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: mail.account_id },
    select: { accountId: true, channelId: true },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  const db = tenantDb(config.accountId);
  const { message, created } = await ingestOutboundEmail(
    db,
    toOutboundEmail(mail, config.channelId),
  );
  if (!created || !message) {
    return ok({ ok: true, ignored: "own_message", created: false });
  }

  // Un envoi d'HISTORIQUE — synchronisé à la connexion, daté d'avant la
  // demande d'un rattrapage encore ouvert — est rangé, jamais relu à
  // contretemps (même règle que la réception).
  const ouvert = await getOpenCatchup(db, config.channelId);
  if (ouvert && estHistorique(mail.date, ouvert.requestedAt)) {
    expireTenantData();
    return ok({ ok: true, messageId: message.id, historique: true, own: true });
  }

  expireTenantData();

  // Capté par l'écoute d'une affaire : Relvo la relit à la lumière de ce qui
  // vient de partir — ce qu'il a décidé, ce à quoi il s'engage. Un envoi sans
  // affaire reste dans sa conversation : la réponse qui viendra se triera
  // avec lui sous les yeux. Rien ne se trie sur un envoi seul.
  if (message.subjectId) {
    const subjectId = message.subjectId;
    after(async () => {
      const resultat = await relireSujet({
        accountId: config.accountId,
        subjectId,
        messageId: message.id,
      });
      console.info("[ia] relecture après envoi", {
        accountId: config.accountId,
        messageId: message.id,
        ...resultat,
      });
    });
  }

  return ok({ ok: true, messageId: message.id, created, own: true });
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

/**
 * La relecture d'un fil de messagerie suivi, après la réponse HTTP (M7
 * tranche 11) : un message capté par l'écoute — reçu, ou envoyé depuis le
 * téléphone — relit l'affaire, avec la discipline de salve du tri. Un échec
 * laisse l'affaire telle qu'elle était, journalisé.
 */
function relireLeFil(args: {
  accountId: string;
  subjectId: string;
  conversationId: string;
  messageId: string;
}) {
  after(async () => {
    const resultat = await relireApresSalve(args);
    console.info("[ia] relecture", {
      accountId: args.accountId,
      messageId: args.messageId,
      ...resultat,
    });
  });
}

async function handleMessageReceived(evt: UnipileMessagingWebhook) {
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

  // Un message ENVOYÉ par le compte connecté revient en `message_received`
  // avec `is_sender: true` : l'écho d'un envoi fait depuis Relvo — déjà en
  // base sous le même identifiant, l'idempotence l'arrête —, ou une RÉPONSE
  // ÉCRITE DEPUIS LE TÉLÉPHONE du dirigeant (M7 tranche 11), qui entre comme
  // un envoi : même conversation, l'affaire qui l'écoute, la tâche de réponse
  // cochée par correspondance, puis la relecture — comme un envoi depuis
  // Relvo (05 §4.1). Sans elle, Relvo perdait la moitié de l'échange.
  if (evt.is_sender) {
    if (!evt.chat_id) return ok({ ok: true, ignored: "own_message" });
    const { message, created } = await ingestOutboundWhatsApp(db, {
      channelId: config.channelId,
      externalId: evt.message_id,
      externalThreadId: evt.chat_id,
      content: evt.message?.trim() ? evt.message.trim() : null,
      sentAt: evt.timestamp != null ? new Date(evt.timestamp) : null,
    });
    if (!created || !message) {
      return ok({ ok: true, ignored: "own_message", created: false });
    }
    expireTenantData();
    if (message.subjectId) {
      relireLeFil({
        accountId: config.accountId,
        subjectId: message.subjectId,
        conversationId: message.conversationId,
        messageId: message.id,
      });
    }
    return ok({ ok: true, messageId: message.id, created, own: true });
  }

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

  // Capté par l'écoute d'une affaire : Relvo la relit à la lumière du message
  // (05 §5.2 — la relecture suit chaque message, reçu ou envoyé), après la
  // salve, comme le tri. C'est ce qui pose le rendez-vous qu'un « 14h c'est
  // parfait » confirme.
  if (created && message.subjectId) {
    relireLeFil({
      accountId: config.accountId,
      subjectId: message.subjectId,
      conversationId: message.conversationId,
      messageId: message.id,
    });
  }

  // Tri automatique d'un fil DIRECT (M7, tranche 11 — A8) : APRÈS la réponse
  // HTTP, une fois par message (`created`), et seulement si aucun sujet n'a
  // capté le message au rangement (une écoute l'aurait pris). Le pipeline
  // décide seul du reste — un groupe n'est pas trié, un message daté d'avant
  // la connexion du numéro est de l'historique, la salve se laisse arriver et
  // seul son dernier message porte le tri — et n'échoue jamais vers
  // l'appelant : un échec laisse la conversation orpheline, journalisé. La
  // réception des e-mails garde son chemin, rien ici ne la touche.
  if (created && !message.subjectId) {
    after(async () => {
      const resultat = await trierConversation({
        accountId: config.accountId,
        conversationId: message.conversationId,
        messageId: message.id,
      });
      console.info("[ia] tri", {
        accountId: config.accountId,
        messageId: message.id,
        ...resultat,
      });
    });
  }

  return ok({ ok: true, messageId: message.id, created, attachments: stored });
}
