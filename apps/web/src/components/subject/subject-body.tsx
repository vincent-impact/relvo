"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Info,
  Mail,
  MessageCircle,
  MessagesSquare,
  Pause,
  Play,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import { EmailMessage } from "@/components/conversations/email-message";
import { RecipientComposer } from "@/components/shared/recipient-composer";
import {
  AddConversationDialog,
  type AddConvContact,
  type AddConvGroup,
  type AddConversationSubmit,
} from "@/components/subject/add-conversation-dialog";
import { sendEmailReplyAction } from "@/server/actions/email";
import { sendWhatsAppReplyAction } from "@/server/actions/whatsapp";
import {
  ignoreConversationAction,
  reactivateConversationAction,
} from "@/server/actions/conversations";
import {
  attachConversationToSubjectAction,
  ensureSubjectAnchorsAction,
  extendSubjectToConversationAction,
} from "@/server/actions/subject-conversations";
import { cn } from "@/lib/utils";

// Orchestrateur de la fiche Sujet (corps interactif). L'onglet « Conversations »
// affiche UN ONGLET PAR CONVERSATION (2026-07-23) : les messages ne se mélangent
// JAMAIS entre deux conversations d'un même sujet. Chaque onglet porte le canal,
// le nom du contact et le nombre de non-lus, plus un bouton Pause/Play pour
// suspendre l'écoute d'une conversation qui déborde du sujet.

type Tab = "informations" | "messages" | "taches" | "detail";

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
  detailPane,
  subjectId,
  subjectTitle,
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
  detailPane: React.ReactNode;
  subjectId: string;
  subjectTitle: string;
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

  // Pause/Play d'une écoute = sourdine réversible de la conversation (invariant :
  // on fait taire une SOURCE, pas un sujet — l'écoute cesse d'alimenter le sujet
  // sans rien détruire).
  function togglePause(pane: SubjectConversationPane) {
    startTransition(async () => {
      const res =
        pane.state === "paused"
          ? await reactivateConversationAction(pane.conversationId)
          : await ignoreConversationAction(pane.conversationId);
      if (res.ok) {
        toast.success(
          pane.state === "paused" ? "Écoute reprise" : "Écoute en pause",
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
    { value: "messages", label: "Conversations", icon: MessagesSquare },
    { value: "detail", label: "Détails", icon: Settings },
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
              {/* Barre d'onglets par conversation + Pause/Play de l'active. */}
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
                          "inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                          isActive
                            ? "border-transparent bg-relvo text-white"
                            : c.state === "paused"
                              ? "border-(--border) bg-white text-(--text-tertiary)"
                              : "border-(--border) bg-white text-(--text-secondary)",
                        )}
                      >
                        <Icon
                          className="size-[14px] flex-none"
                          strokeWidth={2.2}
                        />
                        <span className="max-w-[120px] truncate">
                          {c.title}
                        </span>
                        {c.unreadCount > 0 ? (
                          <span
                            className={cn(
                              "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold",
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

                {/* Pause/Play de la conversation active (sauf écoute terminée). */}
                {active && active.state !== "ended" ? (
                  <button
                    type="button"
                    onClick={() => togglePause(active)}
                    aria-label={
                      active.state === "paused"
                        ? "Reprendre l'écoute"
                        : "Mettre l'écoute en pause"
                    }
                    className={cn(
                      "grid size-8 flex-none place-items-center rounded-full border",
                      active.state === "paused"
                        ? "border-(--green-600) text-(--green-600)"
                        : "border-(--border) text-(--text-secondary)",
                    )}
                  >
                    {active.state === "paused" ? (
                      <Play
                        className="size-4"
                        strokeWidth={2.2}
                        fill="currentColor"
                      />
                    ) : (
                      <Pause
                        className="size-4"
                        strokeWidth={2.2}
                        fill="currentColor"
                      />
                    )}
                  </button>
                ) : null}

                {/* Ajouter une conversation à ce sujet (item 4). */}
                {availableChannels.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    aria-label="Ajouter une conversation"
                    className="grid size-8 flex-none place-items-center rounded-full bg-relvo text-white active:opacity-90"
                  >
                    <Plus className="size-4" strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>

              {active && active.state === "paused" ? (
                <p className="bg-(--surface-2) px-4 py-1.5 text-center text-[12px] font-semibold text-(--amber-600)">
                  Écoute en pause — cette conversation n'alimente plus le sujet.
                </p>
              ) : null}

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
        {tab === "detail" ? detailPane : null}
      </main>

      {tab === "messages" && active && active.reply.kind !== "none" ? (
        <RecipientComposer
          placeholder={composerPlaceholder}
          onSend={handleSend}
        />
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
    </>
  );
}
