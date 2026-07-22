import { z } from "zod";
import {
  ChannelType,
  ConversationStatus,
  ConversationType,
  MessageDirection,
  SubjectStatus,
} from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { contactDisplayName } from "./contacts";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import type { TenantCreate } from "./helpers";
import { type Page, cursorArgs, paginationSchema, toPage } from "./pagination";
import type { WhatsAppChatDirectoryPort } from "./whatsapp-port";

// Domaine Conversations (M6bis) — la couche de TRANSPORT entre Message et
// Subject. Tout ici est DÉTERMINISTE et sans IA : à la réception, on calcule une
// clé canonique, on cherche la conversation correspondante, on la crée si elle
// n'existe pas. Ce calcul ne peut pas échouer — c'est ce qui fait disparaître la
// notion de « message orphelin ».
//
// Ce qui reste au niveau du MESSAGE (`Message.subjectId`), et pas ici :
// l'appartenance à un sujet. Une conversation n'est jamais découpée par thème,
// sinon il faudrait inférer le sujet à la réception et l'identité du fil
// deviendrait instable.

/**
 * Normalise un objet d'email pour le comparer d'un message à l'autre : retire
 * les préfixes de réponse/transfert (Re, Ré, Rép, Fwd, Tr, Aw, Answer…, y
 * compris répétés « Re: Re: »), écrase les espaces, passe en minuscules.
 *
 * ⚠️ La migration `20260720140000_m6bis_conversations` réimplémente cette règle
 * en SQL pour le backfill. Les deux doivent rester d'accord : si l'une dérive,
 * une réponse cesserait de rejoindre la conversation de son message de départ.
 */
export function normalizeSubjectLine(raw: string): string {
  return raw
    .replace(
      /^(\s*(re|ré|rep|rép|répondre|réf|ref|fw|fwd|tr|aw|antw|answer|rv)\s*(\[\d+\])?\s*[:：]\s*)+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const resolveConversationSchema = z.object({
  channelId: z.uuid(),
  channelType: z.enum(ChannelType),
  /** Email ou numéro de l'INTERLOCUTEUR — jamais celui de l'utilisateur, quel
   *  que soit le sens du message. */
  interlocutorRaw: z.string().trim().max(320).optional().nullable(),
  /** Label lisible (nom de profil WhatsApp, display-name email). */
  interlocutorName: z.string().trim().max(200).optional().nullable(),
  contactId: z.uuid().optional().nullable(),
  subjectLine: z.string().trim().max(500).optional().nullable(),
  /** `chat_id` WhatsApp. */
  externalThreadId: z.string().trim().max(255).optional().nullable(),
  isGroup: z.boolean().optional().nullable(),
  /** Nom du groupe quand il est connu (Unipile `getChat`). */
  groupTitle: z.string().trim().max(200).optional().nullable(),
});

export type ResolveConversationInput = z.infer<
  typeof resolveConversationSchema
>;

export type ConversationIdentity = {
  type: ConversationType;
  key: string;
  title: string;
  interlocutorRaw: string | null;
  externalThreadId: string | null;
  normalizedSubject: string | null;
};

/**
 * Calcule l'identité de la conversation d'un message — fonction PURE, cœur du
 * tri déterministe. Chaque type porte son propre discriminant :
 *
 *   email    → `email:<interlocuteur>:<objet normalisé>`
 *   groupe   → `wa-group:<chat_id>`
 *   direct   → `wa-direct:<numéro>`
 *
 * Aucune entrée ne peut faire échouer le calcul : un interlocuteur inconnu
 * donne une chaîne vide, ce qui range le message dans un seau commun plutôt
 * que de le laisser sans conversation. Ne jamais lever d'exception ici — un
 * message qu'on ne saurait pas ranger serait un message perdu à la réception.
 */
export function conversationIdentity(
  input: ResolveConversationInput,
): ConversationIdentity {
  const interlocutor = input.interlocutorRaw?.trim().toLowerCase() || "";
  const thread = input.externalThreadId?.trim() || "";

  if (input.channelType === ChannelType.whatsapp) {
    // Groupe : le fil EST l'identité. Sans `chat_id` on DÉGRADE en conversation
    // directe plutôt que de fusionner des groupes distincts sous une clé
    // commune — au pire le groupe se présente comme un fil direct, au mieux on
    // n'a rien perdu.
    if (input.isGroup && thread) {
      return {
        type: ConversationType.whatsapp_group,
        key: `wa-group:${thread}`,
        // Le nom de l'expéditeur ne fait JAMAIS le titre d'un groupe : il le
        // ferait passer pour une conversation directe avec cette personne.
        title: input.groupTitle?.trim() || WHATSAPP_GROUP_PLACEHOLDER,
        interlocutorRaw: null,
        externalThreadId: thread,
        normalizedSubject: null,
      };
    }
    // Direct : l'interlocuteur EST l'identité — d'où une SEULE conversation
    // directe par contact, pour toujours (cf. asymétrie email/WhatsApp).
    const directKey = interlocutor || (thread ? `thread:${thread}` : "");
    return {
      type: ConversationType.whatsapp_direct,
      key: `wa-direct:${directKey}`,
      title:
        input.interlocutorName?.trim() ||
        interlocutor ||
        "Conversation WhatsApp",
      interlocutorRaw: interlocutor || null,
      externalThreadId: thread || null,
      normalizedSubject: null,
    };
  }

  const normalized = input.subjectLine
    ? normalizeSubjectLine(input.subjectLine)
    : "";
  return {
    type: ConversationType.email_subject,
    key: `email:${interlocutor}:${normalized}`,
    title: input.subjectLine?.trim() || "(sans objet)",
    interlocutorRaw: interlocutor || null,
    externalThreadId: thread || null,
    normalizedSubject: normalized,
  };
}

/**
 * Find-or-create de la conversation d'un message entrant/sortant. Idempotent
 * sur `(accountId, key)`.
 *
 * Enrichit au passage une conversation déjà connue : le contact et le nom de
 * groupe arrivent souvent APRÈS la création (contact créé à l'ouverture d'un
 * sujet, nom de groupe récupéré via `getChat`). On complète alors les trous,
 * sans jamais écraser une valeur déjà renseignée.
 */
export async function resolveConversation(
  db: Tx,
  input: ResolveConversationInput,
) {
  const data = resolveConversationSchema.parse(input);
  const identity = conversationIdentity(data);

  const existing = await db.conversation.findFirst({
    where: { key: identity.key },
  });

  if (!existing) {
    return db.conversation.create({
      data: {
        channelId: data.channelId,
        type: identity.type,
        key: identity.key,
        title: identity.title,
        // Un groupe n'a JAMAIS de contact : il n'a pas d'interlocuteur unique,
        // il EST l'interlocuteur.
        contactId:
          identity.type === ConversationType.whatsapp_group
            ? null
            : (data.contactId ?? null),
        interlocutorRaw: identity.interlocutorRaw,
        externalThreadId: identity.externalThreadId,
        normalizedSubject: identity.normalizedSubject,
      } satisfies TenantCreate<Prisma.ConversationUncheckedCreateInput> as Prisma.ConversationUncheckedCreateInput,
    });
  }

  const patch: Record<string, unknown> = {};
  if (
    !existing.contactId &&
    data.contactId &&
    identity.type !== ConversationType.whatsapp_group
  ) {
    patch.contactId = data.contactId;
  }
  if (!existing.externalThreadId && identity.externalThreadId) {
    patch.externalThreadId = identity.externalThreadId;
  }
  // Le vrai nom d'un groupe remplace le placeholder — mais jamais un nom déjà
  // obtenu (l'utilisateur pourrait l'avoir vu s'afficher).
  if (
    identity.type === ConversationType.whatsapp_group &&
    data.groupTitle?.trim() &&
    existing.title === WHATSAPP_GROUP_PLACEHOLDER
  ) {
    patch.title = data.groupTitle.trim();
  }
  if (Object.keys(patch).length === 0) return existing;

  await db.conversation.updateMany({ where: { id: existing.id }, data: patch });
  return { ...existing, ...patch } as typeof existing;
}

// ─────────────────────────────────────────────────────────────
// Nom & type d'un fil WhatsApp (M6bis.7)
// ─────────────────────────────────────────────────────────────

/** Titre posé tant qu'on ne connaît pas le vrai nom du groupe. */
export const WHATSAPP_GROUP_PLACEHOLDER = "Groupe WhatsApp";

export const whatsAppChatLookupSchema = z.object({
  /** `chat_id` Unipile — l'identité du fil côté fournisseur. */
  chatId: z.string().trim().max(255).optional().nullable(),
  /** `is_group` du webhook : simple INDICE, écrasé par le port s'il répond. */
  isGroupHint: z.boolean().optional().nullable(),
});

export type WhatsAppChatLookupInput = z.infer<typeof whatsAppChatLookupSchema>;

/**
 * Complète l'identité d'un fil WhatsApp entrant : son TYPE (groupe ou direct) et,
 * pour un groupe, son NOM — deux informations que le webhook ne donne pas de
 * façon fiable, et qu'il faut donc aller lire chez le fournisseur.
 *
 * ⚠️ Le point de tout ce code est de N'APPELER LE PORT QUE QUAND C'EST UTILE.
 * On est dans un webhook : un aller-retour réseau par message reçu serait un coût
 * permanent pour une donnée qui ne change quasiment jamais. La conversation
 * existante sert donc de CACHE — c'est le point d'accroche le plus simple, parce
 * qu'il est déjà persistant, déjà scopé au tenant, et déjà indexé par le fil.
 * Trois cas, un seul appelle le réseau :
 *
 *   - aucune conversation pour ce fil          → APPEL (on ne sait rien) ;
 *   - groupe connu, titre encore placeholder   → APPEL (on retente le nom) ;
 *   - groupe nommé, ou conversation directe    → RIEN (on sait déjà).
 *
 * On ne re-classe JAMAIS un fil déjà connu : la clé de conversation dérive du
 * type, la changer scinderait un fil en deux. Le type autoritaire s'applique donc
 * là où il compte — à la création.
 *
 * Best-effort de bout en bout : port absent, réponse `null` ou exception, on
 * retombe sur l'indice du webhook et le titre placeholder.
 */
export async function resolveWhatsAppChatIdentity(
  db: Tx,
  input: WhatsAppChatLookupInput,
  directory?: WhatsAppChatDirectoryPort | null,
): Promise<{ isGroup: boolean; groupTitle: string | null }> {
  const data = whatsAppChatLookupSchema.parse(input);
  const fallback = { isGroup: data.isGroupHint ?? false, groupTitle: null };

  const chatId = data.chatId?.trim();
  if (!chatId || !directory) return fallback;

  const known = await db.conversation.findFirst({
    where: { externalThreadId: chatId },
    select: { type: true, title: true },
  });

  if (known) {
    if (known.type !== ConversationType.whatsapp_group) {
      // Fil direct déjà établi : rien à nommer, rien à demander.
      return { isGroup: false, groupTitle: null };
    }
    if (known.title !== WHATSAPP_GROUP_PLACEHOLDER) {
      // Groupe déjà nommé : le cas de très loin le plus fréquent — zéro réseau.
      return { isGroup: true, groupTitle: null };
    }
  }

  try {
    const identity = await directory.getChatIdentity(chatId);
    if (!identity)
      return known ? { isGroup: true, groupTitle: null } : fallback;
    return {
      // Le type de l'API fait autorité sur `is_group`… sauf pour un fil déjà
      // connu comme groupe, qu'on ne rétrograde pas (cf. supra).
      isGroup: identity.isGroup || Boolean(known),
      groupTitle: identity.name,
    };
  } catch (err) {
    // Une identité illisible ne coûte qu'une étiquette ; l'ingestion continue.
    console.warn("[conversations] identité de fil WhatsApp illisible", err);
    return known ? { isGroup: true, groupTitle: null } : fallback;
  }
}

/**
 * RÈGLE D'ANCRAGE (M6bis.4, révisée M6ter) — destination d'un message qui arrive.
 * On cherche l'ÉCOUTE encore ouverte sur la conversation : un lien
 * `SubjectConversation` dont la BORNE DE FIN n'est pas posée
 * (`closingMessageId == null`). Cette seule condition tient les DEUX régimes sans
 * jamais tester le canal (invariant n°13bis) :
 *
 *   • email    → le lien permanent n'a jamais de borne → toujours à l'écoute →
 *     le message rejoint le sujet, et s'il était validé/fermé il ROUVRE (n°7).
 *   • WhatsApp → après validation/fermeture la borne est posée → plus d'écoute →
 *     le message retombe orphelin (la conversation redevient « Sans sujet »).
 *
 * `needsReopen` distingue les deux sans que l'appelant ait à connaître le canal :
 * il vaut `true` quand l'écoute couvre le message mais que le sujet n'est plus
 * ouvert — cas qui, structurellement, ne survient que pour l'email (un lien
 * WhatsApp d'un sujet fermé porterait une borne, donc ne serait pas trouvé ici).
 *
 * ⚠️ Une conversation IGNORÉE (mute) est une PAUSE : aucun message ne l'alimente,
 * sans borne de fin — « Réactiver » reprend là où on s'était arrêté.
 */
export async function findListeningSubjectForConversation(
  db: Tx,
  conversationId: string,
): Promise<{ subjectId: string; needsReopen: boolean } | null> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId },
    select: { status: true },
  });
  if (!conversation || conversation.status === ConversationStatus.ignored) {
    return null; // pause : rien ne capte tant que la source est en sourdine
  }
  const link = await db.subjectConversation.findFirst({
    where: { conversationId, closingMessageId: null },
    select: { subjectId: true, subject: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!link) return null;
  return {
    subjectId: link.subjectId,
    needsReopen: link.subject.status !== SubjectStatus.open,
  };
}

export async function getConversation(db: TenantDb, id: string) {
  return assertFound(
    await db.conversation.findFirst({ where: { id } }),
    "Conversation",
  );
}

/** Les trois filtres de la surface de tri (cf. 02-modele-donnees §5bis). */
export type ConversationFilter = "unsorted" | "ignored" | "all";

/**
 * Liste des conversations, plus récente en tête.
 *
 * `unsorted` — le défaut, et la définition du KPI « Sans sujet » : conversations
 * ACTIVES dont le DERNIER message n'est rattaché à aucun sujet, c'est-à-dire
 * celles dont l'activité récente n'est couverte par aucune fenêtre et qui
 * peuvent donc solliciter l'utilisateur. On interroge `lastMessage` (dénormalisé)
 * et non `messages: { some: ... }` : les messages antérieurs à une ancre restent
 * sans sujet par conception, et un `some` ferait rester ces conversations dans
 * le KPI pour toujours.
 */
function conversationFilterWhere(filter: ConversationFilter) {
  if (filter === "ignored") return { status: ConversationStatus.ignored };
  if (filter === "all") return {};
  return {
    status: ConversationStatus.active,
    lastMessage: { is: { subjectId: null } },
  };
}

export async function listConversations(
  db: TenantDb,
  opts: {
    filter?: ConversationFilter;
    channelType?: ChannelType;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<Page<Awaited<ReturnType<typeof getConversation>>>> {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.conversation.findMany({
    ...args,
    where: {
      ...conversationFilterWhere(opts.filter ?? "unsorted"),
      ...(opts.channelType
        ? { channel: { is: { type: opts.channelType } } }
        : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });
  return toPage(rows, limit);
}

// ─────────────────────────────────────────────────────────────
// Surface de tri (M6bis.8/.9) — ce que la page /conversations affiche.
// `listConversations` renvoie des lignes brutes ; l'écran, lui, a besoin d'un
// APERÇU, d'un compteur de non-lus et du canal. On sert donc une projection
// dédiée plutôt que de faire N requêtes depuis la page.
// ─────────────────────────────────────────────────────────────

export type ConversationListItem = {
  id: string;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  /** `email` | `whatsapp` — pilote l'icône de canal de la ligne. */
  channelType: ChannelType;
  lastMessageAt: Date | null;
  /** Première ligne du dernier message (texte aplati), ou son objet à défaut. */
  preview: string;
  /** Messages ENTRANTS non lus — pastille + remontée en tête de liste. */
  unreadCount: number;
  /** Le dernier message est-il couvert par un sujet ? (définition du KPI) */
  lastMessageSorted: boolean;
};

const CONVERSATION_ITEM_INCLUDE = {
  channel: { select: { type: true } },
  lastMessage: {
    select: { content: true, subjectLine: true, subjectId: true },
  },
  _count: {
    select: {
      messages: {
        where: { direction: MessageDirection.incoming, readAt: null },
      },
    },
  },
} as const;

type ConversationItemRow = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_ITEM_INCLUDE;
}>;

function toConversationListItem(c: ConversationItemRow): ConversationListItem {
  const preview =
    c.lastMessage?.content?.replace(/\s+/g, " ").trim() ||
    c.lastMessage?.subjectLine?.trim() ||
    "—";
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    status: c.status,
    channelType: c.channel.type,
    lastMessageAt: c.lastMessageAt,
    preview,
    unreadCount: c._count.messages,
    lastMessageSorted: c.lastMessage?.subjectId != null,
  };
}

/**
 * Page de la liste /conversations : activité décroissante, **non-lus en tête**.
 *
 * ⚠️ Arbitrage assumé : la remontée des non-lus est un tri de PRÉSENTATION,
 * appliqué à la page chargée — Postgres saurait le faire, mais pas via un
 * `orderBy` Prisma sur un compte de relation FILTRÉ, et la pagination curseur
 * exige un ordre stable côté base. Comme les non-lus sont par nature récents,
 * les deux ordres coïncident presque toujours ; le seul cas divergent (un vieux
 * message jamais ouvert) ne remonterait de toute façon pas au-delà de sa page.
 */
export async function listConversationItems(
  db: TenantDb,
  opts: {
    filter?: ConversationFilter;
    channelType?: ChannelType;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<Page<ConversationListItem>> {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.conversation.findMany({
    ...args,
    where: {
      ...conversationFilterWhere(opts.filter ?? "unsorted"),
      ...(opts.channelType
        ? { channel: { is: { type: opts.channelType } } }
        : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    include: CONVERSATION_ITEM_INCLUDE,
  });
  const page = toPage(rows, limit);
  const items = page.items.map(toConversationListItem);
  // Tri stable : les non-lus passent devant, l'ordre d'activité est préservé
  // à l'intérieur de chaque groupe (Array.prototype.sort est stable en ES2019+).
  items.sort((a, b) => Number(b.unreadCount > 0) - Number(a.unreadCount > 0));
  return { items, nextCursor: page.nextCursor };
}

/** Le KPI « Sans sujet » de la page Sujets. */
export function countUnsortedConversations(db: TenantDb): Promise<number> {
  return db.conversation.count({ where: conversationFilterWhere("unsorted") });
}

/**
 * Ignorer une source. Relvo cesse d'analyser, de résumer et de trier ses
 * messages — mais ils continuent d'ARRIVER et d'être stockés : on ne perd rien,
 * ils sortent seulement du champ de travail de l'assistant. C'est le remède au
 * « groupe WhatsApp bavard ».
 */
export async function ignoreConversation(db: TenantDb, id: string) {
  const conversation = await getConversation(db, id);
  await db.conversation.updateMany({
    where: { id },
    data: { status: ConversationStatus.ignored },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: id,
    eventType: EVENT_TYPES.conversationIgnored,
    title: `Conversation ignorée — ${conversation.title}`,
    actor: "user",
  });
  return { ...conversation, status: ConversationStatus.ignored };
}

export async function reactivateConversation(db: TenantDb, id: string) {
  const conversation = await getConversation(db, id);
  await db.conversation.updateMany({
    where: { id },
    data: { status: ConversationStatus.active },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: id,
    eventType: EVENT_TYPES.conversationReactivated,
    title: `Conversation réactivée — ${conversation.title}`,
    actor: "user",
  });
  return { ...conversation, status: ConversationStatus.active };
}

/**
 * Ouvrir une conversation vaut lecture de ses messages reçus (acquittement
 * implicite, invariant n°10). Le non-lu vit ICI et non sur le sujet : c'est
 * dans la conversation que les messages arrivent, et tout message a une
 * conversation — plus aucun message n'est condamné à rester non-lu faute de
 * sujet, comme l'étaient les orphelins.
 */
export async function markConversationRead(db: TenantDb, id: string) {
  const { count } = await db.message.updateMany({
    where: {
      conversationId: id,
      direction: MessageDirection.incoming,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { messagesRead: count };
}

// ─────────────────────────────────────────────────────────────
// Fil d'une conversation (M6bis.9) — la timeline + de quoi dessiner le CORDON
// DE SUJET. Le cordon a besoin, message par message, du sujet et du DOMAINE de
// ce sujet : c'est le domaine qui donne la couleur du point, et l'égalité de
// `subjectId` entre deux messages CONSÉCUTIFS qui décide du trait entre eux.
// ─────────────────────────────────────────────────────────────

export type ConversationMessageItem = {
  id: string;
  direction: MessageDirection;
  content: string | null;
  subjectLine: string | null;
  /** Nom lisible de l'expéditeur (contact > nom de profil > identifiant brut). */
  senderName: string;
  sentAt: Date;
  read: boolean;
  /** Sujet couvrant CE message ; null = message hors de toute fenêtre. */
  subject: {
    id: string;
    reference: string;
    title: string;
    /** Domaine du sujet — source de la couleur du point du cordon. */
    folder: { slug: string; color: string | null; icon: string | null } | null;
  } | null;
  attachments: {
    id: string;
    name: string;
    label: string | null;
    mimeType: string | null;
  }[];
};

/** Un sujet qui écoute (ou a écouté) la conversation — matière du bandeau. */
export type ConversationListening = {
  subjectId: string;
  reference: string;
  title: string;
  folder: { slug: string; color: string | null; icon: string | null } | null;
  /** L'écoute est-elle encore ouverte (borne de fin non posée) ? */
  active: boolean;
};

export type ConversationThread = {
  id: string;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  channelType: ChannelType;
  contactId: string | null;
  interlocutorRaw: string | null;
  messages: ConversationMessageItem[];
  /**
   * Écoutes du fil (M6ter) — le signal d'appartenance côté conversation. L'UI en
   * fait le bandeau « Suivi dans : … » (écoute ACTIVE) + « N sujets passés »
   * (écoutes terminées). Une conversation email n'a qu'une écoute, permanente.
   */
  listenings: ConversationListening[];
};

const CONVERSATION_MESSAGE_INCLUDE = {
  senderContact: { select: { firstName: true, lastName: true } },
  subject: {
    select: {
      id: true,
      reference: true,
      title: true,
      folder: { select: { slug: true, color: true, icon: true } },
    },
  },
  attachments: {
    select: { id: true, name: true, aiLabel: true, mimeType: true },
  },
} as const;

/**
 * Fil complet d'une conversation, ordre CHRONOLOGIQUE (façon messagerie) —
 * l'inverse de la pile d'événements de `/messages`, qui présentait les messages
 * du plus récent au plus ancien.
 *
 * Volontairement NON paginé en V1 : une conversation est bornée par nature (un
 * objet d'email, un fil WhatsApp), et un cordon qu'on ne verrait qu'en morceaux
 * perdrait ce qu'il est censé montrer — l'entrelacement des sujets. Un plafond
 * dur protège malgré tout le cas pathologique du groupe très bavard.
 */
const CONVERSATION_THREAD_MAX = 200;

export async function getConversationThread(
  db: TenantDb,
  id: string,
): Promise<ConversationThread> {
  const conversation = assertFound(
    await db.conversation.findFirst({
      where: { id },
      include: { channel: { select: { type: true } } },
    }),
    "Conversation",
  );

  const rows = await db.message.findMany({
    where: { conversationId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: CONVERSATION_THREAD_MAX,
    include: CONVERSATION_MESSAGE_INCLUDE,
  });

  // Écoutes du fil — actives d'abord, puis passées (les plus récentes en tête).
  const links = await db.subjectConversation.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    include: {
      subject: {
        select: {
          id: true,
          reference: true,
          title: true,
          folder: { select: { slug: true, color: true, icon: true } },
        },
      },
    },
  });
  const listenings: ConversationListening[] = links
    .map((l) => ({
      subjectId: l.subject.id,
      reference: l.subject.reference,
      title: l.subject.title,
      folder: l.subject.folder,
      active: l.closingMessageId == null,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));

  return {
    id: conversation.id,
    title: conversation.title,
    type: conversation.type,
    status: conversation.status,
    channelType: conversation.channel.type,
    contactId: conversation.contactId,
    interlocutorRaw: conversation.interlocutorRaw,
    listenings,
    messages: rows.map((m) => ({
      id: m.id,
      direction: m.direction,
      content: m.content,
      subjectLine: m.subjectLine,
      senderName: m.senderContact
        ? contactDisplayName(m.senderContact)
        : (m.senderName ?? m.senderRaw ?? "Expéditeur inconnu"),
      sentAt: m.receivedAt ?? m.sentAt ?? m.createdAt,
      read: m.readAt != null,
      subject: m.subject
        ? {
            id: m.subject.id,
            reference: m.subject.reference,
            title: m.subject.title,
            folder: m.subject.folder
              ? {
                  slug: m.subject.folder.slug,
                  color: m.subject.folder.color,
                  icon: m.subject.folder.icon,
                }
              : null,
          }
        : null,
      attachments: m.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        label: a.aiLabel,
        mimeType: a.mimeType,
      })),
    })),
  };
}
