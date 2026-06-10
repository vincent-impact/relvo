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
  subjectArchived: "subject_archived",
  subjectOpened: "subject_opened",
  resolutionSuggested: "resolution_suggested",
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
  taskDeleted: "task_deleted",
  // Attachments
  attachmentCreated: "attachment_created",
  attachmentLabeled: "attachment_labeled",
  attachmentSummarized: "attachment_summarized",
  attachmentAnalyzed: "attachment_analyzed",
  // Actions
  actionDraftPrepared: "action_draft_prepared",
  actionSendMessageDone: "action_send_message_done",
  actionCancelled: "action_cancelled",
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
