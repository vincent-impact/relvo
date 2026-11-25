import {
  ensureOnboardingQuestions,
  recevoirWhatsAppEntrant,
  recevoirWhatsAppSortant,
  requestChannelCatchup,
  resolveMailboxStep,
} from "@relvo/db";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { expireTenantData } from "@/server/cached";
import { type Boite, recevoirCourrier } from "@/server/courrier";
import { completerLesPiecesPortees, recevoirLesPieces } from "@/server/medias";
import { lancerTranche } from "@/server/ia/pipeline/rattrapage";
import { fenetreDeRattrapage } from "@/server/ia/pipeline/rattrapage-regles";
import { relireApresSalve } from "@/server/ia/pipeline/relecture";
import { trierConversation } from "@/server/ia/pipeline/tri";
import { courrierDepuisUnipile } from "@/server/unipile/courrier";
import { fournisseurUnipile } from "@/server/unipile/fournisseur";
import { identiteDuWebhook, toInboundWhatsApp } from "@/server/unipile/map";
import { mentionDuDirigeant } from "@/server/annuaire-messagerie";
import { noterIdentites } from "@relvo/db";
import {
  UNIPILE_AUTH_HEADER,
  verifyWebhookAuth,
} from "@/server/unipile/signature";
import {
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
// (M7 tranche 11), puis trie et structure : le budget de la fonction le couvre
// — l'attente de la salve (`MESSAGERIE.attenteSalveMs`) plus la même marge
// qu'avant son allongement.
export const maxDuration = 150;

// Défense en profondeur : une route qui touche de la donnée tenant ne doit
// jamais être mise en cache CDN (clé = méthode+URL, identique pour tous).
const NO_STORE = {
  "Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

/** Ce que le webhook répond d'un message que le domaine n'a pas importé. */
const IGNORE = {
  ignoree: "conversation_ignored",
  "trop-ancien": "too_old",
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

  // 2) Courrier : reçu, envoyé depuis un client de messagerie, brouillon…
  if (isMailWebhook(payload)) return handleMail(payload);

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
      // La boîte confiée ferme l'étape « première boîte » de la prise en main
      // (05 §11.11) : c'est la connexion qui vaut réponse, jamais le clic.
      await resolveMailboxStep(db, identifier);
      // Les étapes du script qui restent à poser sont posées, le badge
      // s'allume avant même que le dirigeant n'ouvre l'échange ; le même
      // script rejoue, plus court, à chaque canal.
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

/**
 * Le COURRIER de l'agrégateur : résolu au tenant par le compte Unipile, traduit
 * dans la forme pivot de la frontière (`courrierDepuisUnipile` : sa nature
 * d'après `role` et `folders`, #69), puis confié à ce qui suit la réception —
 * le même code que pour tout fournisseur (`recevoirCourrier`, M24.1) :
 * rangement, pièces jointes, historique laissé à la tranche, tri ou relecture
 * après la réponse. `mail_moved` ne porte rien.
 */
async function handleMail(mail: UnipileMailWebhook) {
  if (mail.event === "mail_moved") return ok({ ok: true, ignored: mail.event });
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId: mail.account_id },
    select: {
      accountId: true,
      channelId: true,
      channel: {
        select: { identifier: true, account: { select: { email: true } } },
      },
    },
  });
  if (!config) return ok({ ok: true, ignored: "unknown_account" });

  const boite: Boite = {
    accountId: config.accountId,
    channelId: config.channelId,
    externalAccountId: mail.account_id,
    nosAdresses: [config.channel.identifier, config.channel.account?.email],
  };
  const courrier = courrierDepuisUnipile(mail, boite);
  const bilan = await recevoirCourrier(boite, courrier, fournisseurUnipile);
  if (bilan.ignore === "brouillon" || bilan.ignore === "ecarte") {
    return ok({ ok: true, ignored: bilan.ignore, role: mail.role ?? null });
  }
  if (bilan.ignore) {
    return ok({ ok: true, ignored: "own_message", created: false });
  }
  return ok({
    ok: true,
    messageId: bilan.messageId,
    created: bilan.created,
    historique: bilan.historique || undefined,
    own: courrier.nature === "envoye" || undefined,
    attachments: bilan.piecesStockees,
  });
}

/**
 * La relecture d'un fil de messagerie suivi, après la réponse HTTP (M7
 * tranche 11) : un message capté par l'écoute — reçu, ou envoyé depuis le
 * téléphone — relit le sujet, avec la discipline de salve du tri. Un échec
 * laisse le sujet telle qu'elle était, journalisé.
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
  // un envoi : même conversation, le sujet qui l'écoute, la tâche de réponse
  // cochée par correspondance, puis la relecture — comme un envoi depuis
  // Relvo (05 §4.1). Sans elle, Relvo perdait la moitié de l'échange.
  if (evt.is_sender) {
    // L'auteur d'un message envoyé par le compte, c'est le dirigeant : c'est
    // ainsi que l'annuaire apprend son identifiant (M29.1).
    await noterIdentites(
      db,
      config.channelId,
      identiteDuWebhook(evt.sender, { isSelf: true }),
    );
    if (!evt.chat_id) return ok({ ok: true, ignored: "own_message" });
    const envoi = await recevoirWhatsAppSortant(db, {
      channelId: config.channelId,
      externalId: evt.message_id,
      externalThreadId: evt.chat_id,
      content: evt.message?.trim() ? evt.message.trim() : null,
      sentAt: evt.timestamp != null ? new Date(evt.timestamp) : null,
    });
    if (envoi.ecartee) return ok({ ok: true, ignored: IGNORE[envoi.motif] });
    const { message, created } = envoi;
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
  // L'annuaire des identifiants (M29.1) se nourrit de chaque expéditeur ; et
  // le message sait, sans modèle, s'il mentionne le dirigeant (M29.2).
  const entrant = toInboundWhatsApp(evt, config.channelId);
  await noterIdentites(db, config.channelId, identiteDuWebhook(evt.sender));
  const mentionsSelf = await mentionDuDirigeant(db, {
    channelId: config.channelId,
    chatId: entrant.externalThreadId ?? null,
    content: entrant.content ?? null,
  });
  const recu = await recevoirWhatsAppEntrant(
    db,
    { ...entrant, mentionsSelf },
    unipileChatDirectory,
  );
  // Conversation ignorée (M25.9) : rien n'est importé — ni le texte, ni les
  // médias, que le webhook n'ira donc pas chercher. Le domaine a compté.
  if (recu.ecartee) return ok({ ok: true, ignored: IGNORE[recu.motif] });
  const { message, created } = recu;

  // Médias (M25.3) : DÉCIDER AVANT DE TÉLÉCHARGER — seulement au premier
  // passage. Ce qu'un sujet porte se stocke ; le reste entre comme référence
  // (relue chez l'agrégateur quand on l'ouvre, ou quand un sujet prend le
  // message), un autocollant ou un GIF comme simple trace.
  const pieces =
    created && evt.attachments?.length
      ? await recevoirLesPieces(db, {
          accountId: config.accountId,
          messageId: message.id,
          subjectId: message.subjectId,
          externalMessageId: evt.message_id,
          webhook: evt.attachments,
        })
      : null;

  if (created) expireTenantData();

  // Capté par l'écoute d'un sujet : Relvo la relit à la lumière du message
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
  // décide seul du reste — un groupe n'est trié que sur une mention du
  // dirigeant (M29.4), un message daté d'avant
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
        // Un groupe ne se trie que si le dirigeant y est interpellé (M29.4).
        mention: mentionsSelf,
      });
      console.info("[ia] tri", {
        accountId: config.accountId,
        messageId: message.id,
        ...resultat,
      });
      // Le tri a pu donner un sujet à des messages gardés en référence : ce
      // qu'un sujet porte se complète (M25.5). Sans rien à compléter, une
      // requête et c'est tout.
      await completerLesPiecesPortees({
        accountId: config.accountId,
        budgetMs: 30_000,
      });
    });
  }

  return ok({
    ok: true,
    messageId: message.id,
    created,
    attachments: pieces?.stockees ?? 0,
    references: pieces?.references || undefined,
  });
}
