"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  type Picto,
  Envelope,
  Users,
  WhatsappLogo,
} from "@/components/shared/picto";
import { toast } from "sonner";
import type { ConversationRowData } from "@/lib/conversation-row";
import { initialsFor } from "@/lib/display";
import {
  AddConversationDialog,
  type AddConvContact,
  type AddConvGroup,
  type AddConversationSubmit,
  type AddConvBoite,
} from "@/components/subject/add-conversation-dialog";
import {
  attachConversationToSubjectAction,
  extendSubjectToConversationAction,
} from "@/server/actions/subject-conversations";
import { cn } from "@/lib/utils";
import { ListPanel } from "@/components/shared/list-panel";

// Conversations d'un sujet, en LISTE (2026-07-27). On abandonne le fil embarqué
// dans la fiche : chaque ligne ouvre la conversation dans son écran dédié
// (`/conversations/[id]`), seule surface d'affichage désormais. On gagne la
// cohérence (un seul endroit rend un fil) et un onglet (plus de split par canal).
// La ligne porte assez d'infos — objet, extrait du dernier message, non-lus — pour
// donner envie de cliquer sans imposer le clic pour savoir où en est le fil.

const CHANNEL_ICON: Record<string, Picto> = {
  email: Envelope,
  whatsapp: WhatsappLogo,
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
  const ChannelIcon = CHANNEL_ICON[row.channelType] ?? Envelope;
  const initials = isGroup ? null : initialsFor(row.interlocutorName);
  // L'interlocuteur devant l'aperçu seulement s'il n'est pas déjà le titre
  // (un fil WhatsApp direct s'appelle comme lui).
  const prefix =
    row.interlocutorName && row.interlocutorName !== row.title
      ? row.interlocutorName
      : null;

  // La même ligne que sur /conversations : l'avatar dit l'acteur (ambre =
  // Externe, initiales), le canal est une icône dans la ligne méta, le
  // non-lu se lit à la graisse du titre et à la pastille de 22 px.
  return (
    <Link
      href={`/conversations/${row.id}?from=${encodeURIComponent(fromHref)}`}
      data-list-row
      className={cn(
        "flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)",
        unread ? "bg-white" : "bg-(--fond-enfonce)",
      )}
    >
      <span
        className={cn(
          "chiffre grid size-10 flex-none place-items-center rounded-full text-[14px]",
          unread
            ? "bg-actor-ext-fond text-actor-ext"
            : "bg-(--fond-puce) text-gris",
        )}
      >
        {isGroup ? (
          <Users className="size-[18px]" />
        ) : (
          (initials ?? <ChannelIcon className="size-[18px]" />)
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[14.5px] leading-[18px] text-noir",
              unread ? "font-medium" : "font-normal",
            )}
          >
            {row.title}
          </span>
          <span className="chiffre flex-none text-[13px] leading-[18px] text-gris">
            {row.time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            role="img"
            aria-label={row.channelType === "email" ? "E-mail" : "WhatsApp"}
            className="inline-flex flex-none items-center text-gris"
          >
            <ChannelIcon className="size-3.5" />
          </span>
          <p className="line-clamp-1 min-w-0 flex-1 text-[12px] leading-4 font-normal text-gris">
            {prefix ? <span className="font-medium">{prefix} · </span> : null}
            {row.preview}
          </p>
          {unread ? (
            <span className="chiffre inline-flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-relvo px-1.5 text-[12px] text-white">
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
  boites,
  boiteParContact,
}: {
  subjectId: string;
  subjectTitle: string;
  rows: ConversationRowData[];
  availableChannels: ("email" | "whatsapp")[];
  addContacts: AddConvContact[];
  groups: AddConvGroup[];
  boites: AddConvBoite[];
  boiteParContact: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  // Retour depuis la conversation → on ramène sur l'ONGLET conversations du
  // sujet (pas l'onglet par défaut), sinon désorientation.
  const fromHref = `/sujets/${subjectId}?tab=conversations`;

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
              channelId: input.channelId ?? undefined,
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
        toast.success("Conversation ajoutée à le sujet");
        setShowAdd(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="pt-3 pb-3">
      {rows.length === 0 ? (
        <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
          Aucune conversation rattachée à ce sujet.
        </p>
      ) : (
        <ListPanel>
          {rows.map((row) => (
            <ConversationRow key={row.id} row={row} fromHref={fromHref} />
          ))}
        </ListPanel>
      )}

      {availableChannels.length > 0 ? (
        // Même dessin que « Ajouter une tâche » : un geste secondaire n'est
        // pas un bouton primaire.
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-1 flex items-center gap-2.5 px-5 py-3.5 text-[14px] font-medium text-relvo"
        >
          <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-bg">
            <Plus className="size-[15px]" strokeWidth={2.6} />
          </span>
          Ajouter une conversation
        </button>
      ) : null}

      <AddConversationDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        subjectTitle={subjectTitle}
        availableChannels={availableChannels}
        contacts={addContacts}
        groups={groups}
        boites={boites}
        boiteParContact={boiteParContact}
        pending={pending}
        onSubmit={handleAdd}
      />
    </div>
  );
}
