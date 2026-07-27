"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { ConversationRowData } from "@/lib/conversation-row";
import {
  AddConversationDialog,
  type AddConvContact,
  type AddConvGroup,
  type AddConversationSubmit,
} from "@/components/subject/add-conversation-dialog";
import {
  attachConversationToSubjectAction,
  extendSubjectToConversationAction,
} from "@/server/actions/subject-conversations";
import { cn } from "@/lib/utils";

// Conversations d'un sujet, en LISTE (2026-07-27). On abandonne le fil embarqué
// dans la fiche : chaque ligne ouvre la conversation dans son écran dédié
// (`/conversations/[id]`), seule surface d'affichage désormais. On gagne la
// cohérence (un seul endroit rend un fil) et un onglet (plus de split par canal).
// La ligne porte assez d'infos — objet, extrait du dernier message, non-lus — pour
// donner envie de cliquer sans imposer le clic pour savoir où en est le fil.

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

function ConversationRow({
  row,
  fromHref,
}: {
  row: ConversationRowData;
  fromHref: string;
}) {
  const unread = row.unreadCount > 0;
  const isGroup = row.type === "whatsapp_group";
  const Icon = isGroup ? Users : (CHANNEL_ICON[row.channelType] ?? Mail);

  return (
    <Link
      href={`/conversations/${row.id}?from=${encodeURIComponent(fromHref)}`}
      className={cn(
        "flex gap-3 border-b border-[#f1efeb] px-[18px] py-3.5 last:border-b-0 active:bg-(--surface-2)",
        unread ? "bg-white" : "bg-[#f7f6f3]",
      )}
    >
      {/* Avatar = canal du fil (objectif : rendre le canal évident d'un coup). */}
      <span
        className={cn(
          "grid size-[42px] flex-none place-items-center self-start rounded-full text-white",
          unread ? "bg-(--amber-600)" : "bg-[#c7c5bd]",
        )}
      >
        <Icon className="size-[20px]" strokeWidth={2.1} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* Titre = objet de l'e-mail (ou nom du fil WhatsApp), 2 lignes max. */}
          <span
            className={cn(
              "line-clamp-2 min-w-0 flex-1 text-[15px] leading-[1.3]",
              unread
                ? "font-bold text-(--text-primary)"
                : "font-semibold text-(--text-tertiary)",
            )}
          >
            {row.title}
          </span>
          <span className="mt-px flex-none text-[11.5px] text-(--text-tertiary)">
            {row.time}
          </span>
        </div>

        {/* Interlocuteur + extrait du dernier message, sur une ligne. */}
        <div className="mt-1 flex items-center gap-2">
          <p
            className={cn(
              "line-clamp-1 min-w-0 flex-1 text-[13px] leading-[1.4]",
              unread ? "text-(--text-secondary)" : "text-(--text-tertiary)",
            )}
          >
            {row.interlocutorName ? (
              <span className="font-semibold">{row.interlocutorName} · </span>
            ) : null}
            {row.preview}
          </p>
          {unread ? (
            <span className="inline-flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-white">
              {row.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function SubjectConversationsList({
  subjectId,
  subjectTitle,
  rows,
  availableChannels,
  addContacts,
  groups,
}: {
  subjectId: string;
  subjectTitle: string;
  rows: ConversationRowData[];
  availableChannels: ("email" | "whatsapp")[];
  addContacts: AddConvContact[];
  groups: AddConvGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const fromHref = `/sujets/${subjectId}`;

  // « Ajouter » à ce sujet — e-mail : vraie nouvelle conversation (objet = titre) ;
  // WhatsApp direct : ouvre le fil existant ; WhatsApp groupe : rattache le fil.
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

  return (
    <div className="pb-3">
      {rows.length === 0 ? (
        <div className="px-[22px] py-10 text-center">
          <p className="text-[13.5px] text-(--text-tertiary)">
            Aucune conversation rattachée à ce sujet.
          </p>
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <ConversationRow key={row.id} row={row} fromHref={fromHref} />
          ))}
        </div>
      )}

      {availableChannels.length > 0 ? (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-relvo px-4 py-2 text-[13px] font-bold text-white active:opacity-90"
          >
            <Plus className="size-4" strokeWidth={2.4} />
            Ajouter une conversation
          </button>
        </div>
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
    </div>
  );
}
