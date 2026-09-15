import {
  ActionStatus,
  ActionType,
  Actor,
  ChannelType,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { assertFound, DomainError } from "./errors";
import {
  loadSubjectSheet,
  type StructurationTaskProjection,
  type SubjectSheetProjection,
} from "./structuration";

// Domaine BROUILLON (M7, tranche 7 — M7.7, M7.10) — ce que le brouillon de
// réponse LIT en base, et ce que l'ENVOI d'un message fait aux tâches, sans
// appel au modèle.
//
//   • Une tâche « se répond » quand elle s'accomplit par un message au contact
//     — réponse ou décision à communiquer — et qu'un fil sait la porter : le
//     fil du message qui l'a fait naître, sinon le fil que le sujet écoute.
//   • Le brouillon est rédigé À L'APPUI, dans le fil, jamais à la création de
//     la tâche (`ecarts`, « Le brouillon se prépare à la première ouverture de
//     la zone de rédaction ») ; un brouillon ouvert est réutilisé.
//   • Ce que l'ENVOI fait aux tâches vit dans `./reply-match` (appelé par
//     `createMessage`) : ce module-ci ne fait que lire.

/** Les types de tâche qui s'accomplissent par un message au contact. */
export const REPLYABLE_TASK_KINDS: readonly TaskKind[] = [
  TaskKind.reply,
  TaskKind.decision,
];

// ─────────────────────────────────────────────────────────────
// Où répondre — le fil d'une tâche
// ─────────────────────────────────────────────────────────────

/**
 * Le fil dans lequel chaque tâche se répond : celui du message qui l'a fait
 * naître, sinon le fil que le sujet écoute encore (le plus récent). Résolu en
 * lot, en deux requêtes, pour les listes de tâches.
 */
export async function resolveReplyTargets(
  db: TenantDb,
  tasks: readonly {
    id: string;
    subjectId: string | null;
    messageId: string | null;
    kind: TaskKind;
    status: TaskStatus;
  }[],
): Promise<Map<string, string>> {
  const targets = new Map<string, string>();
  const candidates = tasks.filter(
    (t) =>
      t.status === TaskStatus.open &&
      t.subjectId &&
      REPLYABLE_TASK_KINDS.includes(t.kind),
  );
  if (candidates.length === 0) return targets;

  const messageIds = [
    ...new Set(
      candidates.map((t) => t.messageId).filter((id): id is string => !!id),
    ),
  ];
  const subjectIds = [...new Set(candidates.map((t) => t.subjectId as string))];
  const [messages, listenings] = await Promise.all([
    messageIds.length
      ? db.message.findMany({
          where: { id: { in: messageIds } },
          select: { id: true, conversationId: true },
        })
      : Promise.resolve([]),
    db.subjectConversation.findMany({
      where: { subjectId: { in: subjectIds }, closingMessageId: null },
      orderBy: { createdAt: "desc" },
      select: { subjectId: true, conversationId: true },
    }),
  ]);
  const byMessage = new Map(messages.map((m) => [m.id, m.conversationId]));
  const bySubject = new Map<string, string>();
  for (const l of listenings) {
    if (!bySubject.has(l.subjectId))
      bySubject.set(l.subjectId, l.conversationId);
  }
  for (const t of candidates) {
    const conversationId =
      (t.messageId ? byMessage.get(t.messageId) : undefined) ??
      bySubject.get(t.subjectId as string);
    if (conversationId) targets.set(t.id, conversationId);
  }
  return targets;
}

// ─────────────────────────────────────────────────────────────
// La projection — ce que le brouillon a le droit de lire
// ─────────────────────────────────────────────────────────────

export type DraftProjection = SubjectSheetProjection & {
  accountId: string;
  tache: StructurationTaskProjection & { id: string };
  /** Le fil dans lequel répondre, et de quoi y envoyer. */
  cible: {
    conversationId: string;
    canal: "email" | "whatsapp";
    channelId: string;
    /** Destinataires (e-mail : le set ; messagerie : l'interlocuteur), pour l'affichage. */
    destinataires: string[];
  };
  /** Un brouillon déjà préparé pour cette tâche, encore ouvert — réutilisé plutôt que payé deux fois. */
  brouillonOuvert: { id: string; contenu: string } | null;
};

/** Derniers messages du fil poussés dans la fiche pour rédiger (05 §3.1). */
export const DRAFT_LAST_MESSAGES = 3;

/**
 * Charge tout ce que le profil « brouillon » consomme : la fiche du sujet et
 * de son contact, la tâche, le fil cible. Refuse une tâche qui ne se répond pas.
 */
export async function getDraftProjection(
  db: TenantDb,
  taskId: string,
): Promise<DraftProjection> {
  const task = assertFound(
    await db.task.findFirst({
      where: { id: taskId },
      select: {
        id: true,
        subjectId: true,
        messageId: true,
        title: true,
        kind: true,
        status: true,
        startDate: true,
        sourceActor: true,
        completedAt: true,
      },
    }),
    "Tâche",
  );
  if (!task.subjectId) {
    throw new DomainError("VALIDATION", "Cette tâche n'a pas de sujet.");
  }
  if (task.status !== TaskStatus.open) {
    throw new DomainError("INVALID_STATE", "Cette tâche n'est plus ouverte.");
  }
  const targets = await resolveReplyTargets(db, [task]);
  const conversationId = targets.get(task.id);
  if (!conversationId) {
    throw new DomainError(
      "VALIDATION",
      "Cette tâche ne se répond pas dans un fil.",
    );
  }

  const [sheet, conversation, brouillon] = await Promise.all([
    loadSubjectSheet(db, task.subjectId, { messages: DRAFT_LAST_MESSAGES }),
    db.conversation.findFirstOrThrow({
      where: { id: conversationId },
      select: {
        id: true,
        participantsRaw: true,
        interlocutorRaw: true,
        channel: { select: { id: true, type: true } },
      },
    }),
    db.action.findFirst({
      where: {
        taskId: task.id,
        type: ActionType.send_message,
        status: ActionStatus.open,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, payload: true },
    }),
  ]);

  const contenu = (brouillon?.payload as { content?: unknown } | null)?.content;
  return {
    ...sheet,
    tache: {
      id: task.id,
      titre: task.title,
      type: task.kind,
      date: task.startDate?.toISOString().slice(0, 10) ?? null,
      source: task.sourceActor === Actor.ai ? "relvo" : "moi",
      terminee: false,
      termineeLe: null,
    },
    cible: {
      conversationId: conversation.id,
      canal:
        conversation.channel.type === ChannelType.email ? "email" : "whatsapp",
      channelId: conversation.channel.id,
      destinataires: conversation.participantsRaw.length
        ? conversation.participantsRaw
        : conversation.interlocutorRaw
          ? [conversation.interlocutorRaw]
          : [],
    },
    brouillonOuvert:
      brouillon && typeof contenu === "string"
        ? { id: brouillon.id, contenu }
        : null,
  };
}
