import type { Prisma } from "../generated/prisma/client";
import {
  Actor,
  ConversationStatus,
  ConversationType,
  SubjectStatus,
} from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb } from "../tenant";
import { EVENT_TYPES, logEvent } from "./events";

// LE NETTOYAGE (`ecarts`, « Le nettoyage : ce qui n'a pas de sujet ne reste
// pas ») — ce qui tient la mémoire de Relvo à ce qui sert. Quatre règles, dont
// trois vivent ici :
//
//   1. LA SUPPRESSION. Supprimer un canal ou un compte efface aussitôt tout ce
//      qui en dépend (les cascades de la base, puis la file de suppression pour
//      les fichiers). Supprimer un SUJET ne supprime pas ses conversations :
//      seule l'attache message-sujet et conversation-sujet disparaît. Un
//      dossier, lui, ne détruit rien : son contenu remonte chez son père.
//
//   2. L'EXPIRATION. Rattacher un message à un sujet, c'est dire qu'il compte.
//      Un message qu'AUCUN sujet ne porte, vieux de plus de trente jours, n'a
//      plus de raison de rester : il est effacé, texte et pièces, que sa
//      conversation soit active ou ignorée. Ce qu'un sujet porte reste tant
//      que le sujet existe.
//        · Une conversation E-MAIL dont il ne reste aucun message disparaît
//          avec eux : un objet vide ne veut rien dire.
//        · Une conversation de MESSAGERIE reste, même vide : c'est un fil
//          continu, sans début ni fin — et c'est elle qui retient qu'un fil est
//          ignoré, ou comment un groupe a été jugé.
//        · Une conversation e-mail IGNORÉE qui refuse encore du courrier reste
//          le temps qu'elle en refuse : c'est sa sourdine qui travaille.
//
//   3. L'EFFACEMENT DES SUJETS FERMÉS. Fermer un sujet, c'est le sortir de la
//      zone d'intérêt sans le valider. Trente jours après sa fermeture il est
//      effacé pour de bon — tâches et journal compris ; ses messages
//      redeviennent ordinaires et expirent par la règle 2. Un sujet VALIDÉ ne
//      s'efface jamais ; rouvrir un sujet fermé annule le compte à rebours.
//
//   4. L'IGNORANCE n'efface rien : elle empêche d'accumuler (`./reception`).
//
// Les règles 2 et 3 tournent ensemble, une fois par jour, compte par compte
// (`nettoyerLeCompte`), et disent d'abord ce qu'elles feraient
// (`simulerLeNettoyage`) — les deux lisent LES MÊMES filtres, écrits une fois
// ci-dessous. La garde de la réception (`estTropAncienPourEntrer`) empêche un
// message expiré de revenir quand un fournisseur le rejoue.
//
// Aucun fichier n'est touché ici : effacer la ligne d'une pièce met sa clé dans
// la file de suppression (le déclencheur de M4.6), que le drainage vide.

/** Au-delà de ce délai, ce qu'aucun sujet ne porte n'est plus gardé — ni importé. */
export const RETENTION_SANS_SUJET_JOURS = 30;

/** La date avant laquelle un message sans sujet a expiré. */
export function horizonDuNettoyage(now: Date = new Date()): Date {
  return new Date(now.getTime() - RETENTION_SANS_SUJET_JOURS * 86_400_000);
}

/**
 * Un message daté d'avant l'horizon ne s'importe plus : il aurait expiré
 * aussitôt. C'est ce qui empêche un fournisseur qui rejoue son historique de
 * ramener ce que le nettoyage a effacé — et de le faire trier une seconde fois.
 */
export function estTropAncienPourEntrer(
  date: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!date && date.getTime() < horizonDuNettoyage(now).getTime();
}

/** Un sujet FERMÉ depuis plus longtemps que l'horizon : il s'efface. */
function sujetAEffacer(horizon: Date): Prisma.SubjectWhereInput {
  return { status: SubjectStatus.closed, closedAt: { lt: horizon } };
}

/**
 * Un message EXPIRÉ : daté d'avant l'horizon, porté par aucun sujet — ou par
 * un sujet qui s'efface au même passage —, sans pièce rangée dans un sujet qui
 * reste, et qu'aucune écoute ne prend pour borne.
 */
function messageExpire(horizon: Date): Prisma.MessageWhereInput {
  const condamne = sujetAEffacer(horizon);
  return {
    AND: [
      { OR: [{ subjectId: null }, { subject: { is: condamne } }] },
      {
        // La date du message, comme la liste la montre : reçu, sinon envoyé,
        // sinon créé.
        OR: [
          { receivedAt: { lt: horizon } },
          { receivedAt: null, sentAt: { lt: horizon } },
          { receivedAt: null, sentAt: null, createdAt: { lt: horizon } },
        ],
      },
      {
        attachments: {
          none: { subject: { is: { NOT: condamne } } },
        },
      },
      { anchorFor: { none: { subject: { is: { NOT: condamne } } } } },
      { closingFor: { none: { subject: { is: { NOT: condamne } } } } },
    ],
  };
}

/**
 * Une conversation E-MAIL qui ne garde rien : tous ses messages expirent (ou
 * elle n'en a déjà plus), aucun sujet qui reste ne l'écoute, et — si elle est
 * ignorée — elle n'a refusé aucun courrier depuis l'horizon. Son dernier
 * message date d'avant l'horizon ; une conversation qui n'en a jamais eu doit
 * elle-même avoir trente jours — jamais une conversation qui vient de naître
 * et attend son premier message.
 */
function conversationEmailVide(horizon: Date): Prisma.ConversationWhereInput {
  const condamne = sujetAEffacer(horizon);
  return {
    type: ConversationType.email_subject,
    messages: { every: messageExpire(horizon) },
    subjects: { every: { subject: { is: condamne } } },
    AND: [
      {
        OR: [
          { lastMessageAt: { lt: horizon } },
          { lastMessageAt: null, createdAt: { lt: horizon } },
        ],
      },
    ],
    OR: [
      { status: ConversationStatus.active },
      {
        status: ConversationStatus.ignored,
        OR: [{ unimportedLastAt: null }, { unimportedLastAt: { lt: horizon } }],
      },
    ],
  };
}

/** Ce qu'un passage du nettoyage retire — ou retirerait. */
export type BilanNettoyage = {
  /** Sujets fermés depuis plus de trente jours, effacés. */
  sujetsFermes: number;
  /** Messages sans sujet de plus de trente jours, effacés. */
  messages: number;
  /** Leurs pièces jointes, et leur poids connu en octets. */
  pieces: number;
  octets: number;
  /** Conversations e-mail qui ne gardaient plus rien, disparues avec leurs messages. */
  conversationsEmail: number;
};

export function bilanVide(): BilanNettoyage {
  return {
    sujetsFermes: 0,
    messages: 0,
    pieces: 0,
    octets: 0,
    conversationsEmail: 0,
  };
}

export function additionnerBilans(
  a: BilanNettoyage,
  b: BilanNettoyage,
): BilanNettoyage {
  return {
    sujetsFermes: a.sujetsFermes + b.sujetsFermes,
    messages: a.messages + b.messages,
    pieces: a.pieces + b.pieces,
    octets: a.octets + b.octets,
    conversationsEmail: a.conversationsEmail + b.conversationsEmail,
  };
}

/** Un passage a-t-il quelque chose à retirer ? */
export function bilanEstVide(b: BilanNettoyage): boolean {
  return b.sujetsFermes + b.messages + b.conversationsEmail === 0;
}

/**
 * Ce que le nettoyage RETIRERAIT du compte maintenant — la SIMULATION : rien
 * n'est écrit. Les mêmes filtres que le passage réel.
 */
export async function simulerLeNettoyage(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BilanNettoyage> {
  const horizon = horizonDuNettoyage(now);
  const expire = messageExpire(horizon);
  const [sujetsFermes, messages, pieces, conversationsEmail] =
    await Promise.all([
      db.subject.count({ where: sujetAEffacer(horizon) }),
      db.message.count({ where: expire }),
      db.attachment.aggregate({
        where: { message: { is: expire } },
        _count: { _all: true },
        _sum: { fileSize: true },
      }),
      db.conversation.count({ where: conversationEmailVide(horizon) }),
    ]);
  return {
    sujetsFermes,
    messages,
    pieces: pieces._count._all,
    octets: pieces._sum.fileSize ?? 0,
    conversationsEmail,
  };
}

/**
 * UN PASSAGE du nettoyage sur un compte, dans l'ordre qui garde chaque étape
 * cohérente même si la suivante n'a pas lieu :
 *
 *   a. les sujets fermés depuis plus de trente jours s'effacent — leurs
 *      messages redeviennent ordinaires ;
 *   b. les messages sans sujet de plus de trente jours s'effacent, pièces
 *      comprises (leurs clés partent en file de suppression) ;
 *   c. les conversations e-mail qui ne gardent plus rien disparaissent ;
 *   d. chaque conversation qui a perdu son dernier message retrouve le
 *      dernier qui lui reste — c'est lui qui la range dans « à trier » ou
 *      « suivies » ; une conversation de messagerie vidée n'est plus ni l'un
 *      ni l'autre, jusqu'à son prochain message.
 *
 * Journalisé une fois par passage, quand il a retiré quelque chose. Se rejoue
 * sans effet : ce qui est parti n'est plus à retirer.
 */
export async function nettoyerLeCompte(
  db: TenantDb,
  accountId: string,
  now: Date = new Date(),
): Promise<BilanNettoyage> {
  const horizon = horizonDuNettoyage(now);

  const { count: sujetsFermes } = await db.subject.deleteMany({
    where: sujetAEffacer(horizon),
  });

  const expire = messageExpire(horizon);
  const pieces = await db.attachment.aggregate({
    where: { message: { is: expire } },
    _count: { _all: true },
    _sum: { fileSize: true },
  });
  const { count: messages } = await db.message.deleteMany({ where: expire });

  const { count: conversationsEmail } = await db.conversation.deleteMany({
    where: conversationEmailVide(horizon),
  });

  // Le dernier message de chaque conversation qui a perdu le sien.
  const orphelines = await db.conversation.findMany({
    where: { lastMessageId: null, messages: { some: {} } },
    select: { id: true },
  });
  for (const c of orphelines) {
    const dernier = await db.message.findFirst({
      where: { conversationId: c.id },
      orderBy: [
        { receivedAt: { sort: "desc", nulls: "last" } },
        { sentAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: { id: true, receivedAt: true, sentAt: true, createdAt: true },
    });
    if (!dernier) continue;
    await db.conversation.updateMany({
      where: { id: c.id, lastMessageId: null },
      data: {
        lastMessageId: dernier.id,
        lastMessageAt:
          dernier.receivedAt ?? dernier.sentAt ?? dernier.createdAt,
      },
    });
  }

  const bilan: BilanNettoyage = {
    sujetsFermes,
    messages,
    pieces: pieces._count._all,
    octets: pieces._sum.fileSize ?? 0,
    conversationsEmail,
  };
  if (!bilanEstVide(bilan)) {
    await db.$transaction((tx) =>
      logEvent(tx, {
        entityType: "system",
        entityId: accountId,
        eventType: EVENT_TYPES.nettoyage,
        title: "Nettoyage : ce qu'aucun sujet ne porte, passé trente jours",
        actor: Actor.system,
        metadata: { ...bilan, horizon: horizon.toISOString() },
      }),
    );
  }
  return bilan;
}

/**
 * Tous les comptes — cross-tenant, pour le cron qui passe le nettoyage : il
 * ouvre ensuite un client tenant par compte. Le nettoyage ne dépend ni de
 * l'assistant ni de l'activité : ce qui n'a pas de sujet expire partout.
 */
export async function listComptesANettoyer(): Promise<string[]> {
  const rows = await prisma.account.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => r.id);
}
