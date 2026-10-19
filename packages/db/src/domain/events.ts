import type { Prisma } from "../generated/prisma/client";
import type { Actor, EventEntityType } from "../generated/prisma/enums";
import type { Tx } from "../tenant";

// Journal de bord (M3.12). Helper unique appelé par chaque mutation de domaine,
// dans la même transaction que la mutation, pour garantir un EventLog cohérent.
// `accountId` est injecté automatiquement par l'extension tenant.

/** Catalogue des `event_type` émis par le domaine (cf. 02-modele-donnees §11). */
export const EVENT_TYPES = {
  // Folders
  folderCreated: "folder_created",
  folderUpdated: "folder_updated",
  folderDeleted: "folder_deleted",
  // Knowledge (instructions / documents)
  knowledgeCreated: "knowledge_created",
  knowledgeUpdated: "knowledge_updated",
  knowledgeDeleted: "knowledge_deleted",
  knowledgeActivated: "knowledge_activated",
  knowledgeDeactivated: "knowledge_deactivated",
  // Contacts
  contactCreated: "contact_created",
  contactUpdated: "contact_updated",
  contactCompleted: "contact_completed",
  // Channels
  channelCreated: "channel_created",
  channelUpdated: "channel_updated",
  channelDeleted: "channel_deleted",
  channelConfigUpdated: "channel_config_updated",
  // Subjects
  subjectCreated: "subject_created",
  subjectUpdated: "subject_updated",
  subjectStatusChanged: "subject_status_changed",
  subjectPriorityChanged: "subject_priority_changed",
  subjectResolved: "subject_resolved",
  subjectValidated: "subject_validated",
  subjectClosed: "subject_closed",
  subjectOpened: "subject_opened",
  resolutionSuggested: "resolution_suggested",
  // Conversations (M6bis)
  conversationIgnored: "conversation_ignored",
  conversationReactivated: "conversation_reactivated",
  conversationAttached: "conversation_attached",
  conversationDetached: "conversation_detached",
  anchorMoved: "anchor_moved",
  // Écoute d'un sujet sur une conversation (M6ter) — début (ancre) et fin.
  listeningClosed: "listening_closed",
  listeningResumed: "listening_resumed",
  // Messages
  messageIncomingReceived: "message_incoming_received",
  messageOutgoingSent: "message_outgoing_sent",
  messageLinked: "message_linked",
  messageIgnored: "message_ignored",
  messageReassigned: "message_reassigned",
  messageDetached: "message_detached",
  // Tasks
  taskCreatedByAi: "task_created_by_ai",
  taskCreatedByUser: "task_created_by_user",
  taskUpdated: "task_updated",
  taskCompleted: "task_completed",
  taskReopened: "task_reopened",
  taskDeleted: "task_deleted",
  /** Le dirigeant a répondu à une décision portée par une tâche (05 §3.1) — la question et la réponse en métadonnée. */
  taskDecisionAnswered: "task_decision_answered",
  /** Relvo a retiré une tâche devenue sans objet à la relecture (05 §4.2) — la tâche et la raison en métadonnée. */
  taskRetiredByAi: "task_retired_by_ai",
  // Attachments
  attachmentCreated: "attachment_created",
  attachmentLabeled: "attachment_labeled",
  attachmentSummarized: "attachment_summarized",
  attachmentAnalyzed: "attachment_analyzed",
  // Actions
  actionDraftPrepared: "action_draft_prepared",
  actionSendMessageDone: "action_send_message_done",
  actionCancelled: "action_cancelled",
  // Pipeline IA (M7, tranche 4) — les clés de métadonnées de ces entrées sont
  // posées dans `domain/triage.ts`, premier écrivain (02, EventLog).
  /** Une entrée PAR SOLLICITATION du modèle : jetons, cache, raisonnement, coût en euros (M7.16). */
  iaSollicitation: "ia_sollicitation",
  /** Un appel au modèle qui a ÉCHOUÉ avant ou pendant la réponse (M21.3) : sollicitation, motif, détail — la mesure, s'il y en a une, est une `ia_sollicitation` à part. */
  iaEchec: "ia_echec",
  /** Verdict de tri déposé sur une conversation orpheline (M7.14). */
  triageVerdict: "triage_verdict",
  /** Le tri a échoué : la conversation reste orpheline, rien n'est inventé (M7.15). */
  triageFailed: "triage_failed",
  /** Un sujet nouveau a reçu sa structuration — situation, résumé, tâches, contact (M7.6) ; la proposition intégrale est en métadonnée (05 §9.1). */
  subjectStructured: "subject_structured",
  /** La structuration a échoué : le sujet reste tel que le tri l'a ouvert, sans tâche (M7.15). */
  structurationFailed: "structuration_failed",
  /** Un message entrant sur un sujet suivi a été relu : situation, tâches, priorité, attente, clôture (M7.9, M7.11) ; la proposition intégrale est en métadonnée. */
  subjectReviewed: "subject_reviewed",
  /** La relecture a échoué : le sujet reste tel qu'il était, le message est rangé (M7.15). */
  relectureFailed: "relecture_failed",
  /** Relvo retire sa suggestion de clôture : la situation a évolué (05 §8.5). */
  resolutionRevoked: "resolution_revoked",
  /** Relvo pose « En attente » en relecture : le sujet attend un tiers sans qu'aucun envoi ne l'ait dit (05 §5.3). */
  waitingForReplySet: "waiting_for_reply_set",
  /** L'attente est levée sans message : le dirigeant a coché la dernière tâche (04 §10). */
  waitingForReplyLifted: "waiting_for_reply_lifted",
  // Compte — l'assistant activé ou coupé (réglage de l'utilisateur, ou
  // l'administrateur depuis le backoffice : acteur `system`, motif en métadonnée).
  assistantEnabled: "assistant_enabled",
  assistantDisabled: "assistant_disabled",
  // L'administration (M21) — chaque geste sur un compte est journalisé sur le
  // compte visé ; la suppression, elle, l'est sur le compte de l'administrateur
  // (celui du compte supprimé disparaît avec lui).
  /** Le rôle du compte a changé (script `admin:role`) — ancien et nouveau rôle en métadonnée. */
  roleChanged: "role_changed",
  /** L'accès a été ouvert par un administrateur (M21.6) : le compte peut se connecter. */
  accountActivated: "account_activated",
  /** Le compte est marqué, ou n'est plus marqué, « test » (M21.4). */
  accountTestMarked: "account_test_marked",
  accountTestUnmarked: "account_test_unmarked",
  /** Un compte a été supprimé — définitivement — par un administrateur ; l'e-mail et le bilan en métadonnée. */
  accountDeleted: "account_deleted",
  // Rattrapage du courrier récent d'un canal (M7.19) — demandé à la connexion,
  // commencé la nuit, clos avec ses compteurs en métadonnée.
  catchupRequested: "catchup_requested",
  catchupStarted: "catchup_started",
  catchupFinished: "catchup_finished",
  // Les questions de Relvo (M18.9, 05 §11.12) — posée, répondue, écartée ; la
  // réponse et sa destination en métadonnée.
  questionAsked: "question_asked",
  questionAnswered: "question_answered",
  questionDismissed: "question_dismissed",
  // Les secteurs du compte, posés par une réponse de la prise en main.
  sectorsUpdated: "sectors_updated",
  // Le push (M12.7, M12.9) — un appareil abonné ou retiré, une notification
  // envoyée (sa nature en métadonnée : bienvenue, brief, question).
  pushSubscribed: "push_subscribed",
  pushUnsubscribed: "push_unsubscribed",
  pushSent: "push_sent",
} as const;

export type EventInput = {
  entityType: EventEntityType;
  eventType: string;
  title: string;
  actor: Actor;
  entityId?: string | null;
  subjectId?: string | null;
  messageId?: string | null;
  taskId?: string | null;
  actionId?: string | null;
  /** Renseigné uniquement quand actor = contact (cf. 02-modele-donnees §11). */
  contactId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * D'où vient une écriture demandée par le dirigeant AUTREMENT que par l'écran —
 * aujourd'hui l'échange avec Relvo (05 §11.6, M10.13). Elle voyage en
 * métadonnée de l'entrée de journal que la fonction écrit déjà : aucun
 * changement de schéma, et l'audit distingue un geste du chat d'un geste de
 * l'interface ou du pipeline.
 */
export type Origine = { source: "chat" };

/** La métadonnée d'un événement, avec son origine quand il y en a une. */
export function avecOrigine(
  metadata: Record<string, unknown> | null | undefined,
  origine?: Origine | null,
): Record<string, unknown> | null {
  if (!origine) return metadata ?? null;
  return { ...(metadata ?? {}), source: origine.source };
}

/**
 * Insère un EventLog. À appeler dans la transaction de la mutation qui le
 * justifie. `accountId` est ajouté par l'extension tenant.
 */
export async function logEvent(db: Tx, input: EventInput) {
  return db.eventLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId ?? input.subjectId ?? null,
      eventType: input.eventType,
      title: input.title,
      actor: input.actor,
      subjectId: input.subjectId ?? null,
      messageId: input.messageId ?? null,
      taskId: input.taskId ?? null,
      actionId: input.actionId ?? null,
      contactId: input.contactId ?? null,
      description: input.description ?? null,
      metadata: (input.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    } as Prisma.EventLogUncheckedCreateInput,
  });
}
