import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  ChannelType,
  ConversationStatus,
  ConversationType,
  MessageStatus,
  SubjectStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { conversationIdentity, resolveConversation } from "./conversations";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import type { TenantCreate } from "./helpers";

// Domaine SubjectConversation (M6bis.12) — la table de liaison qui dit « ce
// sujet est la fenêtre active sur cette conversation ». Elle ne porte PAS
// l'appartenance des messages (qui vit sur `Message.subjectId`) : elle porte la
// RÈGLE DE ROUTAGE des messages à venir, plus son point de départ (l'ancre).
//
// Le cas d'usage central de ce fichier est le cas S : un sujet parti d'un fil
// WhatsApp se poursuit par email. C'est là que se fait la réunification entre
// canaux — un sujet porte alors deux conversations, chacune avec son ancre.

// ─────────────────────────────────────────────────────────────
// Balayage — le cœur PARTAGÉ de l'ouverture et du rattachement
// ─────────────────────────────────────────────────────────────

/**
 * Balaie les messages d'une conversation dans un sujet. Teste l'ANCRE, jamais le
 * canal (invariant n°13bis) :
 *
 *   • ancre NULLE → tout le fil (amont compris). C'est le cas EMAIL : le sujet
 *     EST le fil, il n'y a pas de « à partir d'où », il n'y a que « tout ».
 *   • ancre POSÉE → du message d'ancre jusqu'à la fin. C'est le cas WhatsApp :
 *     l'écoute commence là où l'utilisateur l'a décidé.
 *
 * Ne prend QUE les messages encore sans sujet et non ignorés : on ne vole jamais
 * un message déjà rattaché ailleurs (l'entrelacement, invisible en UI jusqu'à M7,
 * reste vrai dans le modèle). Nombre de requêtes CONSTANT (cf. incident P2028).
 */
export async function sweepConversationIntoSubject(
  db: TenantDb,
  opts: {
    conversationId: string;
    subjectId: string;
    anchorMessageId?: string | null;
  },
): Promise<{ swept: number }> {
  const anchorAt = opts.anchorMessageId
    ? ((
        await db.message.findFirst({
          where: { id: opts.anchorMessageId },
          select: { createdAt: true },
        })
      )?.createdAt ?? null)
    : null;

  const covered = {
    conversationId: opts.conversationId,
    subjectId: null,
    status: { not: MessageStatus.ignored },
    // Ancre posée → ordre d'insertion ≥ ancre (l'ancre elle-même incluse).
    ...(anchorAt ? { createdAt: { gte: anchorAt } } : {}),
  } satisfies Prisma.MessageWhereInput;

  const [{ count: swept }] = await db.$transaction([
    db.message.updateMany({
      where: covered,
      data: { subjectId: opts.subjectId, status: MessageStatus.linked },
    }),
    db.attachment.updateMany({
      where: { message: { is: covered } },
      data: { subjectId: opts.subjectId },
    }),
  ]);
  return { swept };
}

// ─────────────────────────────────────────────────────────────
// Arrêt / reprise des écoutes — piloté par les transitions de statut
// ─────────────────────────────────────────────────────────────

/**
 * Arrête les écoutes WhatsApp d'un sujet qu'on VALIDE ou FERME : chaque lien
 * WhatsApp encore ouvert (`closingMessageId == null`) reçoit sa BORNE DE FIN = le
 * dernier message du sujet dans cette conversation. Les messages postérieurs
 * retomberont donc orphelins.
 *
 * ⚠️ Les liens EMAIL sont INTOUCHÉS : le sujet EST le fil, il n'a pas de fin — un
 * nouvel email le rouvre (invariant n°7). On distingue par le TYPE de la
 * conversation (email = permanent), une propriété de donnée, pas « le canal ».
 * Appelée DANS la transaction de changement de statut.
 */
export async function closeListeningsForSubject(
  tx: Tx,
  subjectId: string,
): Promise<number> {
  const links = await tx.subjectConversation.findMany({
    where: {
      subjectId,
      closingMessageId: null,
      conversation: { is: { type: { not: ConversationType.email_subject } } },
    },
    select: { id: true, conversationId: true },
  });
  let closed = 0;
  for (const link of links) {
    const last = await tx.message.findFirst({
      where: { subjectId, conversationId: link.conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (!last) continue; // écoute sans aucun message couvert : rien à borner
    await tx.subjectConversation.updateMany({
      where: { id: link.id },
      data: { closingMessageId: last.id },
    });
    closed += 1;
  }
  return closed;
}

/**
 * Reprend les écoutes d'un sujet qu'on ROUVRE : on efface la borne de fin de ses
 * liens. Symétrique de `closeListeningsForSubject`. Les liens email n'en avaient
 * pas — sans effet sur eux.
 *
 * ⚠️ On ne relance PAS une écoute sur une conversation qu'un AUTRE sujet écoute
 * déjà (garde V1 : au plus une écoute active par conversation). Le lien reste
 * alors borné : le vieux sujet garde ses anciens messages, le fil continue
 * d'alimenter le concurrent. Dégradation silencieuse plutôt qu'une erreur au clic
 * sur « Remettre ». Appelée DANS la transaction de changement de statut.
 */
export async function resumeListeningsForSubject(
  tx: Tx,
  subjectId: string,
): Promise<number> {
  const links = await tx.subjectConversation.findMany({
    where: { subjectId, closingMessageId: { not: null } },
    select: { id: true, conversationId: true },
  });
  let resumed = 0;
  for (const link of links) {
    const competing = await tx.subjectConversation.findFirst({
      where: {
        conversationId: link.conversationId,
        closingMessageId: null,
        subjectId: { not: subjectId },
      },
      select: { id: true },
    });
    if (competing) continue; // une autre écoute occupe déjà le fil
    await tx.subjectConversation.updateMany({
      where: { id: link.id },
      data: { closingMessageId: null },
    });
    resumed += 1;
  }
  return resumed;
}

// ─────────────────────────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────────────────────────

/**
 * Une conversation portée par un sujet, à plat. On aplatit délibérément le canal
 * et l'interlocuteur : l'appelant (fiche Sujet) en a besoin pour savoir PAR OÙ
 * répondre, et la conversation est désormais la source de vérité de la cible
 * d'envoi — plus fiable que « le dernier message entrant de ce contact », qui
 * n'existe pas encore quand on vient d'étendre le sujet à un nouveau canal.
 */
export type SubjectConversationLink = {
  id: string;
  conversationId: string;
  anchorMessageId: string | null;
  /** Borne de fin de l'écoute (M6ter) — non nulle = écoute terminée. */
  closingMessageId: string | null;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  channelId: string;
  channelType: ChannelType;
  contactId: string | null;
  interlocutorRaw: string | null;
  externalThreadId: string | null;
};

export async function listSubjectConversations(
  db: TenantDb,
  subjectId: string,
): Promise<SubjectConversationLink[]> {
  const rows = await db.subjectConversation.findMany({
    where: { subjectId },
    orderBy: { createdAt: "asc" },
    include: {
      conversation: {
        include: { channel: { select: { type: true } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    anchorMessageId: row.anchorMessageId,
    closingMessageId: row.closingMessageId,
    title: row.conversation.title,
    type: row.conversation.type,
    status: row.conversation.status,
    channelId: row.conversation.channelId,
    channelType: row.conversation.channel.type,
    contactId: row.conversation.contactId,
    interlocutorRaw: row.conversation.interlocutorRaw,
    externalThreadId: row.conversation.externalThreadId,
  }));
}

/**
 * Conversations ENCORE ACTIVES portées par un sujet — l'entrée de la proposition
 * « souhaitez-vous aussi ignorer la conversation ? » enchaînée à une fermeture
 * (cas Q). Fermer un sujet referme une fenêtre ; ça ne tarit pas la source.
 */
export async function listIgnorableConversations(
  db: TenantDb,
  subjectId: string,
): Promise<{ id: string; title: string }[]> {
  const links = await listSubjectConversations(db, subjectId);
  return links
    .filter((l) => l.status === ConversationStatus.active)
    .map((l) => ({ id: l.conversationId, title: l.title }));
}

// ─────────────────────────────────────────────────────────────
// Attacher / détacher une conversation
// ─────────────────────────────────────────────────────────────

export const attachConversationSchema = z.object({
  subjectId: z.uuid(),
  conversationId: z.uuid(),
  /**
   * Message d'ancrage. Facultatif, et c'est le cas normal du cas S : au moment
   * où l'on étend un sujet à un nouvel interlocuteur, le premier message
   * n'existe pas encore — c'est l'envoi qui le créera. L'ancre est alors posée
   * après coup par `ensureSubjectAnchors`.
   */
  anchorMessageId: z.uuid().optional().nullable(),
});

export type AttachConversationInput = z.infer<typeof attachConversationSchema>;

/**
 * Rattache une conversation à un sujet (idempotent sur `(subject, conversation)`).
 *
 * Fait respecter la **règle métier V1 : au plus un sujet `ouvert` par
 * conversation**. Sans elle, la destination d'un message entrant deviendrait
 * ambiguë — et rien, tant qu'aucune IA ne sait séparer des sujets entrelacés,
 * ne saurait trancher. C'est une règle métier et non une contrainte de modèle :
 * la lever ne demandera aucune migration.
 */
export async function attachConversationToSubject(
  db: TenantDb,
  input: AttachConversationInput,
) {
  const data = attachConversationSchema.parse(input);

  const subject = assertFound(
    await db.subject.findFirst({ where: { id: data.subjectId } }),
    "Sujet",
  );
  const conversation = assertFound(
    await db.conversation.findFirst({ where: { id: data.conversationId } }),
    "Conversation",
  );

  const existing = await db.subjectConversation.findFirst({
    where: { subjectId: data.subjectId, conversationId: data.conversationId },
  });
  if (existing) return existing; // no-op idempotent : aucun événement en double

  // Garde V1 (alignée M6ter) : une écoute active = un lien sans borne de fin.
  // Couvre le 1:1 permanent de l'email (lien toujours actif) ET le « un seul
  // sujet ouvert à la fois » du WhatsApp, sans tester le canal.
  const competing = await db.subjectConversation.findFirst({
    where: { conversationId: data.conversationId, closingMessageId: null },
    select: { subjectId: true },
  });
  if (competing) {
    throw new DomainError(
      "CONFLICT",
      "Cette conversation est déjà écoutée par un sujet ouvert.",
    );
  }

  return db.$transaction(async (tx) => {
    const link = await tx.subjectConversation.create({
      data: {
        subjectId: data.subjectId,
        conversationId: data.conversationId,
        anchorMessageId: data.anchorMessageId ?? null,
      } satisfies TenantCreate<Prisma.SubjectConversationUncheckedCreateInput> as Prisma.SubjectConversationUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.conversationAttached,
      title: `Conversation rattachée — ${conversation.title}`,
      actor: "user",
      metadata: { conversationId: conversation.id, type: conversation.type },
    });
    return link;
  });
}

/**
 * Rattache un fil EMAIL à un sujet EXISTANT (2e option du swipe droite email,
 * M6ter) — attache la conversation ET balaie tout le fil dans le sujet : le sujet
 * EST le fil, ancre nulle, amont compris. La garde V1 d'`attachConversationToSubject`
 * empêche de rattacher un fil déjà écouté par un sujet ouvert.
 */
export async function attachEmailConversationToSubject(
  db: TenantDb,
  subjectId: string,
  conversationId: string,
) {
  const link = await attachConversationToSubject(db, {
    subjectId,
    conversationId,
  });
  await sweepConversationIntoSubject(db, {
    conversationId,
    subjectId,
    anchorMessageId: null,
  });
  return link;
}

/**
 * Rattache une conversation WhatsApp à un sujet EXISTANT À PARTIR d'un message
 * (« Lier à un sujet », 2026-07-23) — l'écoute démarre à cette ANCRE et balaie
 * tout l'aval. Symétrique de `attachEmailConversationToSubject`, mais avec une
 * borne de départ (le WhatsApp n'a pas d'objet, il faut dire où l'écoute commence).
 */
export async function attachConversationToSubjectFromMessage(
  db: TenantDb,
  subjectId: string,
  messageId: string,
) {
  const message = assertFound(
    await db.message.findFirst({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    }),
    "Message",
  );
  await attachConversationToSubject(db, {
    subjectId,
    conversationId: message.conversationId,
    anchorMessageId: message.id,
  });
  await sweepConversationIntoSubject(db, {
    conversationId: message.conversationId,
    subjectId,
    anchorMessageId: message.id,
  });
  return { subjectId };
}

export async function detachConversationFromSubject(
  db: TenantDb,
  subjectId: string,
  conversationId: string,
) {
  const link = assertFound(
    await db.subjectConversation.findFirst({
      where: { subjectId, conversationId },
      include: { conversation: { select: { title: true } } },
    }),
    "Conversation du sujet",
  );
  return db.$transaction(async (tx) => {
    await tx.subjectConversation.deleteMany({ where: { id: link.id } });
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subjectId,
      subjectId,
      eventType: EVENT_TYPES.conversationDetached,
      title: `Conversation détachée — ${link.conversation.title}`,
      actor: "user",
      metadata: { conversationId },
    });
    return { id: link.id };
  });
}

/**
 * Pose les ancres manquantes d'un sujet : pour chaque conversation rattachée
 * sans ancre, le PLUS ANCIEN message du sujet dans cette conversation devient le
 * point de départ de la fenêtre.
 *
 * C'est la deuxième moitié du cas S : on rattache d'abord (l'utilisateur choisit
 * un interlocuteur), le message n'arrive qu'ensuite (il écrit). Fonction
 * auto-réparatrice et idempotente — on l'appelle après un envoi sans avoir à
 * savoir si l'ancre manquait.
 */
export async function ensureSubjectAnchors(db: TenantDb, subjectId: string) {
  const pending = await db.subjectConversation.findMany({
    where: {
      subjectId,
      anchorMessageId: null,
      // Les liens EMAIL n'ont PAS d'ancre : le sujet EST le fil (ancre nulle =
      // tout le fil). Seules les écoutes WhatsApp ont un point de départ à poser.
      conversation: { is: { type: { not: ConversationType.email_subject } } },
    },
    select: { id: true, conversationId: true },
  });
  if (pending.length === 0) return { anchored: 0 };

  let anchored = 0;
  for (const link of pending) {
    const first = await db.message.findFirst({
      where: { subjectId, conversationId: link.conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (!first) continue;
    await db.subjectConversation.updateMany({
      where: { id: link.id },
      data: { anchorMessageId: first.id },
    });
    anchored += 1;
  }
  return { anchored };
}

// ─────────────────────────────────────────────────────────────
// Cas S — étendre un sujet à une seconde conversation
// ─────────────────────────────────────────────────────────────

export const extendSubjectSchema = z.object({
  subjectId: z.uuid(),
  /** L'interlocuteur qu'on veut ajouter au sujet (contact existant). */
  contactId: z.uuid(),
  /** Canal par lequel on veut le joindre. */
  channelType: z.enum(ChannelType),
});

export type ExtendSubjectInput = z.infer<typeof extendSubjectSchema>;

/**
 * Étend un sujet à une seconde conversation (cas S) — « parti d'un fil WhatsApp,
 * j'écris par email au fournisseur pour la même affaire ».
 *
 * ⚠️ MÊME GESTE CÔTÉ INTERFACE, DEUX MÉCANIQUES DESSOUS. C'est l'asymétrie
 * structurante du modèle, et c'est ici qu'elle est absorbée :
 *
 *   • email          → une VRAIE nouvelle conversation est créée. La clé
 *     contient l'objet, donc un nouvel objet = une nouvelle clé. L'objet est
 *     PRÉ-REMPLI par le titre du sujet : c'est ce qui garantit que la réponse du
 *     fournisseur (« Re: <titre> ») retombera sur la même clé, donc dans cette
 *     conversation, donc dans ce sujet — sans qu'aucune IA n'ait à s'en mêler.
 *
 *   • WhatsApp direct → la clé ne contient QUE l'interlocuteur : il ne peut
 *     exister qu'une seule conversation directe par contact, pour toujours. On
 *     RATTACHE donc l'existante, avec une nouvelle ancre.
 *
 * On recherche le fil direct existant par `contactId` AVANT de tomber sur le
 * calcul de clé : l'identifiant WhatsApp stocké à l'ingestion (`sender_raw`,
 * souvent un identifiant fournisseur) n'est pas forcément le numéro tel que
 * l'utilisateur l'a saisi dans sa fiche contact. Se fier à la seule clé
 * risquerait de créer un SECOND fil direct pour le même contact — exactement ce
 * que le modèle interdit.
 *
 * Retourne `created` pour information (journal, tests) ; l'UI, elle, ne doit
 * surtout pas s'en servir pour dire deux choses différentes à l'utilisateur.
 */
export async function extendSubjectToConversation(
  db: TenantDb,
  input: ExtendSubjectInput,
) {
  const data = extendSubjectSchema.parse(input);

  const subject = assertFound(
    await db.subject.findFirst({ where: { id: data.subjectId } }),
    "Sujet",
  );
  // Étendre une fenêtre FIGÉE n'a pas de sens : les messages postérieurs à
  // `closedAt` n'appartiennent plus au sujet, la conversation rattachée
  // n'attraperait donc jamais rien.
  if (subject.status !== SubjectStatus.open) {
    throw new DomainError(
      "INVALID_STATE",
      "Seul un sujet ouvert peut être étendu à une nouvelle conversation.",
    );
  }

  const contact = assertFound(
    await db.contact.findFirst({ where: { id: data.contactId } }),
    "Contact",
  );

  const identifier =
    data.channelType === ChannelType.email ? contact.email : contact.phone;
  if (!identifier) {
    throw new DomainError(
      "VALIDATION",
      data.channelType === ChannelType.email
        ? "Ce contact n'a pas d'adresse email."
        : "Ce contact n'a pas de numéro de téléphone.",
    );
  }

  // Canal d'émission du compte pour ce type (le plus ancien = le principal).
  const channel = assertFound(
    await db.channel.findFirst({
      where: { type: data.channelType },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true },
    }),
    "Canal",
  );

  // 1) WhatsApp direct : on cherche le fil du contact AVANT tout calcul de clé.
  let conversation =
    data.channelType === ChannelType.whatsapp
      ? await db.conversation.findFirst({
          where: {
            type: ConversationType.whatsapp_direct,
            OR: [
              { contactId: contact.id },
              { interlocutorRaw: identifier.trim().toLowerCase() },
            ],
          },
        })
      : null;
  let created = false;

  // 2) Sinon : find-or-create par clé canonique. Pour l'email, l'objet est le
  //    titre du sujet → clé neuve → vraie nouvelle conversation.
  if (!conversation) {
    const identity = conversationIdentity({
      channelId: channel.id,
      channelType: channel.type,
      interlocutorRaw: identifier,
      contactId: contact.id,
      subjectLine:
        data.channelType === ChannelType.email ? subject.title : null,
    });
    const before = await db.conversation.findFirst({
      where: { key: identity.key },
      select: { id: true },
    });
    created = !before;
    conversation = await resolveConversation(db as Tx, {
      channelId: channel.id,
      channelType: channel.type,
      interlocutorRaw: identifier,
      contactId: contact.id,
      subjectLine:
        data.channelType === ChannelType.email ? subject.title : null,
    });
  }

  const link = await attachConversationToSubject(db, {
    subjectId: subject.id,
    conversationId: conversation.id,
  });

  // Le nouvel interlocuteur devient un contact DU SUJET : c'est ce qui le fait
  // apparaître dans le select du composer, donc ce qui rend l'extension utile.
  if (!subject.contactIds.includes(contact.id)) {
    await db.subject.updateMany({
      where: { id: subject.id },
      data: {
        contactIds: [...subject.contactIds, contact.id],
        lastActivityAt: new Date(),
      },
    });
  }

  return { conversation, link, created };
}
