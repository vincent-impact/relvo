import { z } from "zod";
import {
  Actor,
  ConversationType,
  TriageConfidence,
  TriageNature,
  TriageVerdict,
} from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb, Tx } from "../tenant";
import { DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";

// LA LECTURE DES GROUPES, DEUX FOIS PAR JOUR (M29.5). Un groupe WhatsApp ne se
// trie pas au fil de l'eau : hors mention du dirigeant, Relvo lit d'un coup ce
// qui s'y est dit depuis sa dernière lecture. Ce module dit QUELS groupes sont
// à lire et tient le repère « lu jusqu'à » ; ce que la lecture conclut passe
// par les primitives du tri (`./triage`).
//
// Un groupe est À LIRE quand :
//   · il est actif (un groupe ignoré n'est ni importé ni lu) ;
//   · Relvo l'a déjà JUGÉ (M29.3) — un groupe sans avis se juge d'abord, à son
//     prochain message ;
//   · aucun sujet ne l'écoute — un groupe qui porte un sujet se suit en
//     direct, par la relecture (M29.6) ;
//   · il a reçu, depuis le repère, au moins un message ENTRANT resté sans sujet.
//
// L'AVIS QUE PORTE UN GROUPE EST CELUI DU GROUPE (M29.3), pas celui de sa
// dernière lecture : une lecture qui ne trouve rien à faire ne l'écrase pas —
// sinon chaque groupe gardé afficherait « à ignorer » deux fois par jour, sur
// un « merci ». Elle se note au journal (`noterLectureSansSuite`) et remet à
// zéro la série qui mène à l'ignorance. Seule une lecture qui dit quelque chose
// — un sujet, un doute, un groupe qui sort du champ professionnel — pose un avis.
//
// Le repère est la date de CRÉATION du dernier message montré à Relvo — pas
// l'heure de la lecture : un message arrivé pendant l'appel n'est pas sauté.
// Tant qu'aucune lecture n'a eu lieu, c'est la date du dernier avis.

export type GroupeALire = {
  conversationId: string;
  /** Les messages créés APRÈS cette date sont ceux à lire. */
  depuis: Date;
  /** Le repère tel qu'il est en base (null avant la première lecture) — c'est lui qu'on réserve. */
  luJusqua: Date | null;
};

/**
 * Les groupes du compte que la lecture du jour doit lire, le plus récemment
 * actif d'abord. Cross-tenant par construction (le cron parcourt les comptes) :
 * le compte est filtré ici, en clair.
 */
export async function listGroupesALire(
  accountId: string,
  limite = 200,
): Promise<GroupeALire[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; depuis: Date; lu_jusqua: Date | null }>
  >`
    SELECT c.id,
           COALESCE(c.group_read_until, c.triaged_at) AS depuis,
           c.group_read_until AS lu_jusqua
    FROM conversations c
    WHERE c.account_id = ${accountId}::uuid
      AND c.type = 'whatsapp_group'
      AND c.status = 'active'
      AND c.triaged_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM subject_conversations sc
        WHERE sc.conversation_id = c.id AND sc.closing_message_id IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = c.id
          AND m.direction = 'incoming'
          AND m.subject_id IS NULL
          AND m.status <> 'ignored'
          AND m.created_at > COALESCE(c.group_read_until, c.triaged_at)
      )
    ORDER BY c.last_message_at DESC NULLS LAST, c.id
    LIMIT ${limite}
  `;
  return rows.map((r) => ({
    conversationId: r.id,
    depuis: r.depuis,
    luJusqua: r.lu_jusqua,
  }));
}

/**
 * RÉSERVE la lecture d'un groupe : avance le repère de `de` à `a`, seulement
 * s'il vaut encore `de`. Deux lectures lancées en même temps ne lisent pas le
 * même groupe deux fois — la seconde trouve le repère déjà avancé et s'efface.
 * Rend `true` quand la réservation est prise.
 */
export async function reserverLectureGroupe(
  db: TenantDb,
  args: { conversationId: string; de: Date | null; a: Date },
): Promise<boolean> {
  const { count } = await db.conversation.updateMany({
    where: { id: args.conversationId, groupReadUntil: args.de },
    data: { groupReadUntil: args.a },
  });
  return count === 1;
}

/**
 * REND une réservation : la lecture a échoué, ses messages restent à lire. Le
 * repère ne recule que s'il est encore celui que cette lecture avait posé.
 */
export async function rendreLectureGroupe(
  db: TenantDb,
  args: { conversationId: string; de: Date | null; a: Date },
): Promise<void> {
  await db.conversation.updateMany({
    where: { id: args.conversationId, groupReadUntil: args.a },
    data: { groupReadUntil: args.de },
  });
}

export const noterLectureSansSuiteSchema = z.object({
  conversationId: z.uuid(),
  /** Le dernier message lu — porte l'entrée de journal. */
  messageId: z.uuid(),
  verdict: z.enum(TriageVerdict),
  nature: z.enum(TriageNature),
  confidence: z.enum(TriageConfidence),
  reason: z.string().trim().min(1).max(1000),
  /** La sortie du modèle, intégrale, pour la boucle d'apprentissage (05 §9.1). */
  proposal: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Note une lecture du jour qui n'a RIEN trouvé à faire : une entrée de journal,
 * et la série d'ignorance remise à zéro. L'avis que porte le groupe — celui de
 * son jugement, ou de la dernière lecture qui a dit quelque chose — ne bouge pas.
 */
export async function noterLectureSansSuite(
  db: TenantDb,
  input: z.input<typeof noterLectureSansSuiteSchema>,
): Promise<void> {
  const data = noterLectureSansSuiteSchema.parse(input);
  await db.$transaction(async (tx) => {
    const { count } = await tx.conversation.updateMany({
      where: { id: data.conversationId },
      data: { noiseStreak: 0 },
    });
    if (count === 0)
      throw new DomainError("NOT_FOUND", "Conversation introuvable.");
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: data.messageId,
      messageId: data.messageId,
      eventType: EVENT_TYPES.groupRead,
      title: "Groupe lu : rien à faire",
      description: data.reason,
      actor: Actor.ai,
      metadata: {
        conversationId: data.conversationId,
        verdict: data.verdict,
        nature: data.nature,
        confidence: data.confidence,
        reason: data.reason,
        proposal: data.proposal ?? null,
      },
    });
  });
}

/**
 * Combien de sujets Relvo a-t-il ouverts sur des GROUPES depuis `depuis` ?
 * C'est ce que le garde-fou de la lecture du jour compte : passé un certain
 * nombre par compte, une lecture n'ouvre plus — elle écrit son avis sur le
 * groupe, et le dirigeant ouvre lui-même ce qu'il veut suivre.
 */
export async function compterSujetsNesDesGroupes(
  db: TenantDb,
  depuis: Date,
): Promise<number> {
  return db.subject.count({
    where: {
      createdByActor: Actor.ai,
      createdAt: { gte: depuis },
      conversations: {
        some: { conversation: { type: ConversationType.whatsapp_group } },
      },
    },
  });
}
