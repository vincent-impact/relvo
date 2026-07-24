"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  FileText,
  Info,
  Mail,
  MessageCircle,
  MessagesSquare,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import { EmailMessage } from "@/components/conversations/email-message";
import { RecipientComposer } from "@/components/shared/recipient-composer";
import type { SubjectStatus } from "@relvo/db";
import {
  AddConversationDialog,
  type AddConvContact,
  type AddConvGroup,
  type AddConversationSubmit,
} from "@/components/subject/add-conversation-dialog";
import { SubjectInfoDock } from "@/components/subject/subject-info-dock";
import { sendEmailReplyAction } from "@/server/actions/email";
import { sendWhatsAppReplyAction } from "@/server/actions/whatsapp";
import {
  attachConversationToSubjectAction,
  detachConversationFromSubjectAction,
  ensureSubjectAnchorsAction,
  extendSubjectToConversationAction,
} from "@/server/actions/subject-conversations";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

// Orchestrateur de la fiche Sujet (corps interactif). L'onglet « Conversations »
// affiche UN ONGLET PAR CONVERSATION (2026-07-23) : les messages ne se mélangent
// JAMAIS entre deux conversations d'un même sujet. Chaque onglet porte le canal,
// le nom du contact et le nombre de non-lus. Un bouton « retirer » (corbeille)
// DÉTACHE la conversation active du sujet. L'onglet « Détail » a été remplacé par
// « Documents » (2026-07-24) ; le concept de pause a été retiré.

type Tab = "informations" | "messages" | "taches" | "documents";

/** Cible d'envoi d'une conversation (le canal par lequel on répond). */
export type ReplyTarget =
  | {
      kind: "email";
      channelId: string;
      email: string;
      contactId: string | null;
    }
  | {
      kind: "whatsapp";
      channelId: string;
      chatId: string;
      contactId: string | null;
    }
  | { kind: "none" };

/** Une conversation du sujet, avec SES messages (jamais fusionnés). */
export type SubjectConversationPane = {
  conversationId: string;
  channelType: string;
  /** Nom du contact (ou du groupe) — titre de l'onglet. */
  title: string;
  isGroup: boolean;
  unreadCount: number;
  /** active = écoute en cours ; paused = en sourdine ; ended = écoute terminée. */
  state: "active" | "paused" | "ended";
  messages: MessageBubbleData[];
  reply: ReplyTarget;
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

export function SubjectBody({
  header,
  defaultTab = "informations",
  tasksCount,
  draft,
  informationsPane,
  tachesPane,
  documentsPane,
  documentsCount,
  subjectId,
  subjectTitle,
  subjectStatus,
  conversationPanes,
  availableChannels,
  addContacts,
  groups,
}: {
  header: React.ReactNode;
  defaultTab?: Tab;
  tasksCount: number;
  draft: React.ReactNode;
  informationsPane: React.ReactNode;
  tachesPane: React.ReactNode;
  documentsPane: React.ReactNode;
  documentsCount: number;
  subjectId: string;
  subjectTitle: string;
  subjectStatus: SubjectStatus;
  conversationPanes: SubjectConversationPane[];
  /** Canaux connectés du compte — pilotent le dialog « Ajouter une conversation ». */
  availableChannels: ("email" | "whatsapp")[];
  addContacts: AddConvContact[];
  groups: AddConvGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [showAdd, setShowAdd] = useState(false);
  // Confirmation de détachement (retirer une conversation du sujet).
  const [detachTarget, setDetachTarget] =
    useState<SubjectConversationPane | null>(null);

  // Conversation active : la première encore en écoute, sinon la première.
  const [activeConvId, setActiveConvId] = useState<string>(
    () =>
      (
        conversationPanes.find((c) => c.state === "active") ??
        conversationPanes[0]
      )?.conversationId ?? "",
  );
  const active =
    conversationPanes.find((c) => c.conversationId === activeConvId) ??
    conversationPanes[0] ??
    null;

  async function afterSend() {
    await ensureSubjectAnchorsAction(subjectId);
    router.refresh();
  }

  // Envoi routé par la conversation ACTIVE (jamais d'ambiguïté d'interlocuteur).
  async function handleSend(text: string) {
    if (!active) return false;
    const r = active.reply;
    if (r.kind === "email") {
      const res = await sendEmailReplyAction({
        subjectId,
        channelId: r.channelId,
        to: { identifier: r.email, displayName: active.title },
        recipientContactId: r.contactId ?? undefined,
        subject: `Re: ${subjectTitle}`,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success("Email envoyé");
      await afterSend();
      return true;
    }
    if (r.kind === "whatsapp") {
      const res = await sendWhatsAppReplyAction({
        subjectId,
        channelId: r.channelId,
        chatId: r.chatId,
        recipientContactId: r.contactId ?? undefined,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success(
        active.isGroup ? "Message envoyé au groupe" : "Message envoyé",
      );
      await afterSend();
      return true;
    }
    toast.error("Réponse indisponible pour cette conversation.");
    return false;
  }

  // Détacher (retirer) la conversation du sujet — la conversation continue de
  // vivre, elle cesse simplement d'alimenter CE sujet.
  function detachConv(pane: SubjectConversationPane) {
    startTransition(async () => {
      const res = await detachConversationFromSubjectAction({
        subjectId,
        conversationId: pane.conversationId,
      });
      if (res.ok) {
        toast.success("Conversation retirée du sujet");
        setDetachTarget(null);
        setActiveConvId(
          conversationPanes.find(
            (c) => c.conversationId !== pane.conversationId,
          )?.conversationId ?? "",
        );
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  // « Ajouter une conversation » à ce sujet (item 4, 2026-07-24). E-mail → vraie
  // nouvelle conversation ; WhatsApp direct → ouvre le fil existant du contact ;
  // WhatsApp groupe → rattache le fil du groupe. La création part TOUJOURS d'un
  // sujet (décision produit) : jamais de conversation flottante.
  function handleAdd(input: AddConversationSubmit) {
    startTransition(async () => {
      const res =
        input.kind === "email"
          ? await extendSubjectToConversationAction({
              subjectId,
              contactId: input.contactId,
              channelType: "email",
              subjectLine: input.subjectLine,
            })
          : input.kind === "whatsapp-contact"
            ? await extendSubjectToConversationAction({
                subjectId,
                contactId: input.contactId,
                channelType: "whatsapp",
                openExistingOnly: true,
              })
            : await attachConversationToSubjectAction({
                subjectId,
                conversationId: input.conversationId,
              });
      if (res.ok) {
        toast.success("Conversation ajoutée au sujet");
        setShowAdd(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const options: SegTabOption[] = [
    { value: "informations", label: "Informations", icon: Info },
    { value: "taches", label: "Tâches", icon: CalendarDays, count: tasksCount },
    {
      value: "messages",
      label: "Conversations",
      icon: MessagesSquare,
      count: conversationPanes.length,
    },
    {
      value: "documents",
      label: "Documents",
      icon: FileText,
      count: documentsCount,
    },
  ];

  // Placeholder du composer, dérivé de la conversation active.
  const composerPlaceholder = !active
    ? "Répondre…"
    : active.isGroup
      ? "Répondre au groupe…"
      : `Répondre à ${active.title}…`;

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        {header}
        <SegTabs
          options={options}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          overlap
          iconOnly
        />

        {tab === "informations" ? informationsPane : null}

        {tab === "messages" ? (
          conversationPanes.length === 0 ? (
            <div className="px-[22px] py-10 text-center">
              <p className="text-[13.5px] text-(--text-tertiary)">
                Aucune conversation rattachée à ce sujet.
              </p>
              {availableChannels.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-relvo px-4 py-2 text-[13px] font-bold text-white active:opacity-90"
                >
                  <Plus className="size-4" strokeWidth={2.4} />
                  Ajouter une conversation
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Barre d'onglets par conversation (titres plus gros, scrollables)
                  + retirer (corbeille) l'active + ajouter. */}
              <div className="flex items-center gap-2 border-b border-(--border) bg-(--surface-2) px-3 py-2">
                <div className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {conversationPanes.map((c) => {
                    const Icon = c.isGroup
                      ? Users
                      : (CHANNEL_ICON[c.channelType] ?? Mail);
                    const isActive = c.conversationId === activeConvId;
                    return (
                      <button
                        key={c.conversationId}
                        type="button"
                        onClick={() => setActiveConvId(c.conversationId)}
                        className={cn(
                          "inline-flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                          isActive
                            ? "border-transparent bg-relvo text-white"
                            : "border-(--border) bg-white text-(--text-secondary)",
                        )}
                      >
                        <Icon
                          className="size-[15px] flex-none"
                          strokeWidth={2.2}
                        />
                        <span className="max-w-[140px] truncate">
                          {c.title}
                        </span>
                        {c.unreadCount > 0 ? (
                          <span
                            className={cn(
                              "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-extrabold",
                              isActive
                                ? "bg-white/30 text-white"
                                : "bg-brand text-white",
                            )}
                          >
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Retirer la conversation active du sujet (détacher). */}
                {active ? (
                  <button
                    type="button"
                    onClick={() => setDetachTarget(active)}
                    aria-label="Retirer cette conversation du sujet"
                    className="grid size-9 flex-none place-items-center rounded-full border border-(--red-200) text-(--red-600) active:bg-(--red-50)"
                  >
                    <Trash2 className="size-[17px]" strokeWidth={2} />
                  </button>
                ) : null}

                {/* Ajouter une conversation à ce sujet (item 4). */}
                {availableChannels.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    aria-label="Ajouter une conversation"
                    className="grid size-9 flex-none place-items-center rounded-full bg-relvo text-white active:opacity-90"
                  >
                    <Plus className="size-[18px]" strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-[15px] px-2.5 pt-4 pb-3">
                {!active || active.messages.length === 0 ? (
                  <p className="text-[13.5px] text-(--text-tertiary)">
                    Aucun message dans cette conversation.
                  </p>
                ) : (
                  active.messages.map((b) =>
                    b.channelType === "email" ? (
                      <EmailMessage key={b.id} data={b} />
                    ) : (
                      <MessageBubble key={b.id} data={b} />
                    ),
                  )
                )}
                {draft}
              </div>
            </>
          )
        ) : null}

        {tab === "taches" ? tachesPane : null}
        {tab === "documents" ? documentsPane : null}
      </main>

      {tab === "messages" && active && active.reply.kind !== "none" ? (
        <RecipientComposer
          placeholder={composerPlaceholder}
          onSend={handleSend}
        />
      ) : null}

      {/* Dock d'actions selon le statut (onglet Informations). */}
      {tab === "informations" ? (
        <SubjectInfoDock subjectId={subjectId} status={subjectStatus} />
      ) : null}

      <AddConversationDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        subjectTitle={subjectTitle}
        availableChannels={availableChannels}
        contacts={addContacts}
        groups={groups}
        pending={pending}
        onSubmit={handleAdd}
      />

      <ConfirmDialog
        open={detachTarget != null}
        onOpenChange={(o) => {
          if (!o) setDetachTarget(null);
        }}
        tone="destructive"
        icon={Trash2}
        title="Retirer cette conversation ?"
        description={
          detachTarget
            ? `« ${detachTarget.title} » sera détachée du sujet et cessera de l'alimenter. La conversation elle-même n'est pas supprimée.`
            : ""
        }
        confirmLabel="Retirer"
        pending={pending}
        onConfirm={() => detachTarget && detachConv(detachTarget)}
      />
    </>
  );
}
