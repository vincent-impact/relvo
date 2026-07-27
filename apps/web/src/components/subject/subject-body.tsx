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
  detachConversationFromSubjectAction,
  ensureSubjectAnchorsAction,
  extendSubjectToConversationAction,
  attachConversationToSubjectAction,
  stopListeningOnConversationAction,
} from "@/server/actions/subject-conversations";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

// Orchestrateur de la fiche Sujet (corps interactif). DEUX ONGLETS PAR CANAL
// (M6quater, 2026-07-25) : « E-mail » (enveloppe) et « Messagerie » (double
// bulle) remplacent l'onglet unique « Conversations ». On DIVERGE sur le rendu,
// les gestes et la surface, JAMAIS sur le domaine (invariant n°13bis) :
//
//   • E-mail   → conversations PAR SET de destinataires (« Groupe » si ≥ 2),
//     rendu pleine largeur, « Ajouter » = écrire un e-mail (objet = titre du
//     sujet), retirer = DÉTACHER le fil (rattrapage d'erreur).
//   • Messagerie → conversations ÉCOUTÉES (WhatsApp…), bulles, « Ajouter » =
//     choisir un fil existant, retirer = ARRÊTER L'ÉCOUTE (borne de fin).
//
// Chaque onglet a SON composer, SON « Ajouter » et SON active-conv. Les messages
// ne se mélangent jamais entre deux conversations.

type Tab = "informations" | "email" | "messagerie" | "taches" | "documents";

/** Cible d'envoi d'une conversation (le canal par lequel on répond). */
export type ReplyTarget =
  | {
      kind: "email";
      channelId: string;
      /** SET complet de destinataires (reply-all) — jamais un seul. */
      recipients: { identifier: string; displayName?: string }[];
      /** Contact principal (rattachement du message) — null pour un groupe. */
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
  /** Sous-type de conversation (M6quater) → l'onglet où elle vit. */
  kind: "email" | "messagerie";
  channelType: string;
  /** Nom du contact (ou « Groupe ») — titre de l'onglet. */
  title: string;
  isGroup: boolean;
  /** Noms lisibles du set (e-mail uniquement) — l'en-tête « À : … » d'un groupe. */
  participants: string[];
  unreadCount: number;
  /** active = écoute en cours ; paused = en sourdine ; ended = écoute terminée. */
  state: "active" | "paused" | "ended";
  messages: MessageBubbleData[];
  reply: ReplyTarget;
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
  // Dialog « Ajouter » — la valeur porte le canal verrouillé de l'onglet appelant.
  const [addChannel, setAddChannel] = useState<"email" | "whatsapp" | null>(
    null,
  );
  // Confirmation de retrait (détacher / arrêter l'écoute selon le canal).
  const [removeTarget, setRemoveTarget] =
    useState<SubjectConversationPane | null>(null);

  const emailPanes = conversationPanes.filter((p) => p.kind === "email");
  const msgPanes = conversationPanes.filter((p) => p.kind === "messagerie");
  const emailConnected = availableChannels.includes("email");
  const waConnected = availableChannels.includes("whatsapp");
  // Un onglet de canal n'apparaît que s'il porte des conversations OU si son
  // canal est connecté (on peut alors y « Ajouter »). Un sujet purement e-mail
  // n'affiche donc pas un onglet Messagerie vide et inerte.
  const showEmail = emailPanes.length > 0 || emailConnected;
  const showMessagerie = msgPanes.length > 0 || waConnected;

  // Active-conv PAR onglet : les deux surfaces ne partagent pas de sélection.
  const [activeEmailId, setActiveEmailId] = useState<string>(
    () => emailPanes.find((c) => c.state === "active")?.conversationId ?? "",
  );
  const [activeMsgId, setActiveMsgId] = useState<string>(
    () => msgPanes.find((c) => c.state === "active")?.conversationId ?? "",
  );

  // Onglet effectif : un défaut pointant vers un onglet masqué retombe sur
  // Informations (jamais d'écran vide sans issue).
  const activeTab: Tab =
    (tab === "email" && !showEmail) || (tab === "messagerie" && !showMessagerie)
      ? "informations"
      : tab;
  const isConvTab = activeTab === "email" || activeTab === "messagerie";

  const panes = activeTab === "email" ? emailPanes : msgPanes;
  const activeConvId = activeTab === "email" ? activeEmailId : activeMsgId;
  const setActiveConvId =
    activeTab === "email" ? setActiveEmailId : setActiveMsgId;
  const active =
    panes.find((c) => c.conversationId === activeConvId) ?? panes[0] ?? null;

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
        // Reply-all : le SET complet part, sinon le sortant crée un fil fantôme.
        to: r.recipients.map((x) => ({
          identifier: x.identifier,
          displayName: x.displayName,
        })),
        recipientContactId: r.contactId ?? undefined,
        subject: `Re: ${subjectTitle}`,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success(
        active.isGroup ? "E-mail envoyé au groupe" : "E-mail envoyé",
      );
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

  // Retirer la conversation active — DEUX mécaniques, une seule intention côté
  // UI : e-mail → DÉTACHER (rattrapage d'erreur, purge le subjectId des messages) ;
  // messagerie → ARRÊTER L'ÉCOUTE (borne de fin, le passé reste rattaché).
  function removeConv(pane: SubjectConversationPane) {
    startTransition(async () => {
      const res =
        pane.kind === "email"
          ? await detachConversationFromSubjectAction({
              subjectId,
              conversationId: pane.conversationId,
            })
          : await stopListeningOnConversationAction({
              subjectId,
              conversationId: pane.conversationId,
            });
      if (res.ok) {
        toast.success(
          pane.kind === "email" ? "Fil détaché du sujet" : "Écoute arrêtée",
        );
        setRemoveTarget(null);
        const rest = (pane.kind === "email" ? emailPanes : msgPanes).filter(
          (c) => c.conversationId !== pane.conversationId,
        );
        setActiveConvId(rest[0]?.conversationId ?? "");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  // « Ajouter » à ce sujet. E-mail → vraie nouvelle conversation (objet = titre) ;
  // WhatsApp direct → ouvre le fil existant du contact ; WhatsApp groupe →
  // rattache le fil du groupe. La création part TOUJOURS d'un sujet.
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
        setAddChannel(null);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const options: SegTabOption[] = [
    { value: "informations", label: "Informations", icon: Info },
    { value: "taches", label: "Tâches", icon: CalendarDays, count: tasksCount },
    ...(showEmail
      ? [
          {
            value: "email",
            label: "E-mail",
            icon: Mail,
            count: emailPanes.length,
          } as const,
        ]
      : []),
    ...(showMessagerie
      ? [
          {
            value: "messagerie",
            label: "Messagerie",
            icon: MessagesSquare,
            count: msgPanes.length,
          } as const,
        ]
      : []),
    {
      value: "documents",
      label: "Documents",
      icon: FileText,
      count: documentsCount,
    },
  ];

  // Composer masqué sur une écoute TERMINÉE : y répondre rouvrirait une écoute
  // qu'on vient d'arrêter (le sortant porte un subjectId explicite).
  const canReply =
    active != null && active.reply.kind !== "none" && active.state !== "ended";
  const composerPlaceholder = !active
    ? "Répondre…"
    : active.isGroup
      ? "Répondre au groupe…"
      : `Répondre à ${active.title}…`;

  const emptyCopy =
    activeTab === "email"
      ? "Aucun fil e-mail rattaché à ce sujet."
      : "Aucune conversation écoutée par ce sujet.";
  const addCurrentLabel =
    activeTab === "email" ? "Écrire un e-mail" : "Écouter une conversation";
  const channelForTab: "email" | "whatsapp" =
    activeTab === "email" ? "email" : "whatsapp";
  const canAddToTab = activeTab === "email" ? emailConnected : waConnected;

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        {header}
        <SegTabs
          options={options}
          value={activeTab}
          onValueChange={(v) => setTab(v as Tab)}
          overlap
          iconOnly
        />

        {activeTab === "informations" ? informationsPane : null}

        {isConvTab ? (
          panes.length === 0 ? (
            <div className="px-[22px] py-10 text-center">
              <p className="text-[13.5px] text-(--text-tertiary)">
                {emptyCopy}
              </p>
              {canAddToTab ? (
                <button
                  type="button"
                  onClick={() => setAddChannel(channelForTab)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-relvo px-4 py-2 text-[13px] font-bold text-white active:opacity-90"
                >
                  <Plus className="size-4" strokeWidth={2.4} />
                  {addCurrentLabel}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Barre d'onglets par conversation + retirer l'active + ajouter. */}
              <div className="flex items-center gap-2 border-b border-(--border) bg-(--surface-2) px-3 py-2">
                <div className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {panes.map((c) => {
                    const Icon = c.isGroup
                      ? Users
                      : activeTab === "email"
                        ? Mail
                        : MessageCircle;
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
                          c.state === "ended" && !isActive && "opacity-55",
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

                {/* Retirer la conversation active du sujet. */}
                {active ? (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(active)}
                    aria-label={
                      active.kind === "email"
                        ? "Détacher ce fil du sujet"
                        : "Arrêter l'écoute"
                    }
                    className="grid size-9 flex-none place-items-center rounded-full border border-(--red-200) text-(--red-600) active:bg-(--red-50)"
                  >
                    <Trash2 className="size-[17px]" strokeWidth={2} />
                  </button>
                ) : null}

                {/* Ajouter une conversation à ce sujet, dans le canal de l'onglet. */}
                {canAddToTab ? (
                  <button
                    type="button"
                    onClick={() => setAddChannel(channelForTab)}
                    aria-label={addCurrentLabel}
                    className="grid size-9 flex-none place-items-center rounded-full bg-relvo text-white active:opacity-90"
                  >
                    <Plus className="size-[18px]" strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>

              {/* En-tête « À : … » d'un groupe e-mail (le set de destinataires). */}
              {active &&
              active.kind === "email" &&
              active.participants.length >= 2 ? (
                <div className="border-b border-(--border-light) bg-white px-[22px] py-2">
                  <p className="text-[12px] leading-snug text-(--text-tertiary)">
                    <span className="font-semibold text-(--text-secondary)">
                      À&nbsp;:
                    </span>{" "}
                    {active.participants.join(", ")}
                  </p>
                </div>
              ) : null}

              {/* Bandeau écoute terminée (messagerie). */}
              {active && active.state === "ended" ? (
                <div className="border-b border-(--border-light) bg-(--surface-2) px-[22px] py-2">
                  <p className="text-[12px] text-(--text-tertiary)">
                    Écoute terminée — les nouveaux messages n’alimentent plus ce
                    sujet.
                  </p>
                </div>
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

        {activeTab === "taches" ? tachesPane : null}
        {activeTab === "documents" ? documentsPane : null}
      </main>

      {isConvTab && active && canReply ? (
        <RecipientComposer
          placeholder={composerPlaceholder}
          onSend={handleSend}
        />
      ) : null}

      {/* Dock d'actions selon le statut (onglet Informations). */}
      {activeTab === "informations" ? (
        <SubjectInfoDock subjectId={subjectId} status={subjectStatus} />
      ) : null}

      <AddConversationDialog
        open={addChannel != null}
        onOpenChange={(o) => {
          if (!o) setAddChannel(null);
        }}
        subjectTitle={subjectTitle}
        availableChannels={availableChannels}
        forceChannel={addChannel ?? undefined}
        contacts={addContacts}
        groups={groups}
        pending={pending}
        onSubmit={handleAdd}
      />

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
        tone="destructive"
        icon={Trash2}
        title={
          removeTarget?.kind === "email"
            ? "Détacher ce fil ?"
            : "Arrêter l'écoute ?"
        }
        description={
          !removeTarget
            ? ""
            : removeTarget.kind === "email"
              ? `« ${removeTarget.title} » sera détaché du sujet (rattrapage d'erreur). La conversation elle-même n'est pas supprimée.`
              : `Le sujet cessera d'écouter « ${removeTarget.title} ». Les messages déjà rattachés restent ; les suivants n'alimenteront plus ce sujet.`
        }
        confirmLabel={
          removeTarget?.kind === "email" ? "Détacher" : "Arrêter l'écoute"
        }
        pending={pending}
        onConfirm={() => removeTarget && removeConv(removeTarget)}
      />
    </>
  );
}
