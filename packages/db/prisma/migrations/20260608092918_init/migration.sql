-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('user', 'ai', 'contact', 'system');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('admin', 'ceo', 'manager', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('auto', 'complete');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "ChannelConfigStatus" AS ENUM ('pending', 'connected', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('new', 'to_do', 'waiting', 'unread', 'resolved', 'archived');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('incoming', 'outgoing');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('received', 'linked', 'sent', 'failed', 'ignored');

-- CreateEnum
CREATE TYPE "TriageHint" AS ENUM ('too_short', 'ambiguous', 'prospection', 'unknown_sender', 'informative_only', 'other');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('decision', 'reply', 'check', 'call', 'inform', 'follow_up', 'other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'deleted');

-- CreateEnum
CREATE TYPE "CompletionMode" AS ENUM ('manual', 'message_match', 'action_match');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('send_message', 'other');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('open', 'in_progress', 'done', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "EventEntityType" AS ENUM ('subject', 'message', 'task', 'action', 'attachment', 'system');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('file', 'note');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'ceo',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "job_title" TEXT,
    "default_folder_id" UUID,
    "status" "ContactStatus" NOT NULL DEFAULT 'auto',
    "source_actor" "Actor" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "folder_ids" UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "connection_data" JSONB,
    "status" "ChannelConfigStatus" NOT NULL DEFAULT 'pending',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "folder_id" UUID,
    "contact_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" "SubjectStatus" NOT NULL DEFAULT 'new',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "source_channel_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "last_opened_at" TIMESTAMP(3),
    "resolution_suggested_at" TIMESTAMP(3),
    "created_by_actor" "Actor" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subject_id" UUID,
    "channel_id" UUID NOT NULL,
    "sender_contact_id" UUID,
    "sender_raw" TEXT,
    "recipient_contact_id" UUID,
    "direction" "MessageDirection" NOT NULL,
    "external_id" TEXT,
    "external_thread_id" TEXT,
    "subject_line" TEXT,
    "content" TEXT,
    "received_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "status" "MessageStatus" NOT NULL DEFAULT 'received',
    "triage_hint" "TriageHint",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "subject_id" UUID,
    "name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "ai_label" TEXT,
    "ai_summary" TEXT,
    "ai_analysis" TEXT,
    "ai_label_at" TIMESTAMP(3),
    "ai_summary_at" TIMESTAMP(3),
    "ai_analysis_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "message_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_actor" "Actor" NOT NULL,
    "kind" "TaskKind" NOT NULL DEFAULT 'other',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "completion_mode" "CompletionMode" NOT NULL DEFAULT 'manual',
    "start_date" DATE,
    "start_time" TIME(6),
    "end_date" DATE,
    "end_time" TIME(6),
    "completed_at" TIMESTAMP(3),
    "completed_by_actor" "Actor",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "task_id" UUID,
    "message_id" UUID,
    "type" "ActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ActionStatus" NOT NULL DEFAULT 'open',
    "executed_by_actor" "Actor",
    "executed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subject_id" UUID,
    "message_id" UUID,
    "task_id" UUID,
    "action_id" UUID,
    "entity_type" "EventEntityType" NOT NULL,
    "entity_id" UUID,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actor" "Actor" NOT NULL,
    "contact_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "kind" "KnowledgeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mime_type" TEXT,
    "file_url" TEXT,
    "file_size" INTEGER,
    "anthropic_file_id" TEXT,
    "ai_label" TEXT,
    "ai_summary" TEXT,
    "content" TEXT,
    "created_by_actor" "Actor" NOT NULL,
    "updated_by_actor" "Actor",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "folders_account_id_idx" ON "folders"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_account_id_slug_key" ON "folders"("account_id", "slug");

-- CreateIndex
CREATE INDEX "contacts_account_id_idx" ON "contacts"("account_id");

-- CreateIndex
CREATE INDEX "contacts_account_id_status_idx" ON "contacts"("account_id", "status");

-- CreateIndex
CREATE INDEX "channels_account_id_idx" ON "channels"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_channel_id_key" ON "channel_configs"("channel_id");

-- CreateIndex
CREATE INDEX "channel_configs_account_id_idx" ON "channel_configs"("account_id");

-- CreateIndex
CREATE INDEX "subjects_account_id_idx" ON "subjects"("account_id");

-- CreateIndex
CREATE INDEX "subjects_account_id_status_idx" ON "subjects"("account_id", "status");

-- CreateIndex
CREATE INDEX "subjects_account_id_priority_idx" ON "subjects"("account_id", "priority");

-- CreateIndex
CREATE INDEX "subjects_account_id_folder_id_idx" ON "subjects"("account_id", "folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_account_id_reference_key" ON "subjects"("account_id", "reference");

-- CreateIndex
CREATE INDEX "messages_account_id_idx" ON "messages"("account_id");

-- CreateIndex
CREATE INDEX "messages_account_id_subject_id_idx" ON "messages"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "messages_account_id_external_id_idx" ON "messages"("account_id", "external_id");

-- CreateIndex
CREATE INDEX "messages_account_id_external_thread_id_idx" ON "messages"("account_id", "external_thread_id");

-- CreateIndex
CREATE INDEX "attachments_account_id_idx" ON "attachments"("account_id");

-- CreateIndex
CREATE INDEX "attachments_account_id_subject_id_idx" ON "attachments"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE INDEX "tasks_account_id_idx" ON "tasks"("account_id");

-- CreateIndex
CREATE INDEX "tasks_account_id_subject_id_idx" ON "tasks"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "tasks_account_id_status_idx" ON "tasks"("account_id", "status");

-- CreateIndex
CREATE INDEX "tasks_account_id_start_date_idx" ON "tasks"("account_id", "start_date");

-- CreateIndex
CREATE INDEX "actions_account_id_idx" ON "actions"("account_id");

-- CreateIndex
CREATE INDEX "actions_account_id_subject_id_idx" ON "actions"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "actions_account_id_status_idx" ON "actions"("account_id", "status");

-- CreateIndex
CREATE INDEX "event_logs_account_id_idx" ON "event_logs"("account_id");

-- CreateIndex
CREATE INDEX "event_logs_account_id_subject_id_idx" ON "event_logs"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "event_logs_account_id_created_at_idx" ON "event_logs"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_account_id_idx" ON "knowledge_documents"("account_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_account_id_folder_id_idx" ON "knowledge_documents"("account_id", "folder_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_default_folder_id_fkey" FOREIGN KEY ("default_folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_source_channel_id_fkey" FOREIGN KEY ("source_channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_contact_id_fkey" FOREIGN KEY ("sender_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
