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
  // Compte — l'assistant activé ou coupé (réglage de l'utilisateur, backoffice demain).
  assistantEnabled: "assistant_enabled",
  assistantDisabled: "assistant_disabled",
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
