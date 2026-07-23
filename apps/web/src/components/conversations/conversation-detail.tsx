"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EyeOff,
  Folder,
  Mail,
  MessageCircle,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ConversationListening } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import {
  createSubjectFromConversationAction,
  ignoreConversationAction,
} from "@/server/actions/conversations";
import { createSubjectFromMessageAction } from "@/server/actions/messages";
import { folderVisual } from "@/lib/folders";
import { initialsFor } from "@/lib/display";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// Header ENRICHI d'une conversation (2026-07-23) + orchestration de la surface.
// Il condense en un coup d'œil : l'interlocuteur, le canal (icône + boîte), le
// domaine (placeholder « Général » tant que Relvo ne le détecte pas), un espace
// résumé (placeholder), les sujets attachés, et un menu à DEUX gestes —
// « Ignorer » / « Ouvrir un sujet ». Plus de bouton Relvo ici (décision : on
// n'appelle pas l'assistant depuis une conversation).
//
// « Ouvrir un sujet » :
//   • email    → le fil EST le sujet → création immédiate sur toute la
//     conversation, puis navigation vers la fiche ;
//   • WhatsApp → on passe le FIL en mode SÉLECTION (pastilles sur les messages,
//     sans changer d'écran) : le message choisi démarre l'écoute.

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

export function ConversationDetail({
  conversationId,
  channelType,
  channelName,
  interlocutorName,
  isGroup,
  listenings,
  messages,
  backTo,
}: {
  conversationId: string;
  channelType: string;
  channelName: string;
  /** Nom de l'interlocuteur (null pour un groupe → on montre le titre du fil). */
  interlocutorName: string | null;
  isGroup: boolean;
  listenings: ConversationListening[];
  messages: ThreadMessageData[];
  backTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);

  const isEmail = channelType === "email";
  const ChannelIcon = CHANNEL_ICON[channelType] ?? Mail;
  const senderLabel = isGroup
    ? "Groupe"
    : (interlocutorName ?? "Interlocuteur inconnu");
  const initials = isGroup ? null : initialsFor(interlocutorName);

  // Domaine : placeholder « Général » tant qu'aucune détection Relvo n'existe
  // (M7). Emplacement réservé, honnête — comme le résumé ci-dessous.
  const domain = folderVisual("general");

  function ignore() {
    startTransition(async () => {
      const res = await ignoreConversationAction(conversationId);
      if (res.ok) {
        toast.success("Conversation ignorée");
        router.push(backTo);
      } else {
        toast.error(res.message);
      }
    });
  }

  function openSubject() {
    // WhatsApp : on ne crée pas sur tout le fil — on demande le point de départ.
    if (!isEmail) {
      setSelecting(true);
      return;
    }
    startTransition(async () => {
      const res = await createSubjectFromConversationAction(conversationId);
      if (res.ok) {
        toast.success("Sujet créé");
        router.push(`/sujets/${res.data.id}?from=/conversations`);
      } else {
        toast.error(res.message);
      }
    });
  }

  function pickAnchor(messageId: string) {
    startTransition(async () => {
      const res = await createSubjectFromMessageAction(messageId);
      if (res.ok) {
        toast.success("Sujet ouvert sur ce fil");
        router.push(`/sujets/${res.data.id}?from=/conversations`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      <div className="border-b border-(--border) bg-white px-4 pt-3.5 pb-4">
        {/* Interlocuteur + canal + domaine */}
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-[38px] flex-none place-items-center rounded-full text-[13px] font-extrabold text-white",
              isGroup ? "bg-(--text-tertiary)" : "bg-(--amber-600)",
            )}
          >
            {isGroup ? (
              <Users className="size-[18px]" strokeWidth={2.2} />
            ) : (
              (initials ?? "?")
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-(--text-primary)">
              {senderLabel}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-(--text-tertiary)">
              <ChannelIcon className="size-[13px] flex-none" strokeWidth={2} />
              <span className="truncate">{channelName}</span>
            </div>
          </div>
          {/* Domaine détecté par Relvo (placeholder) */}
          <span
            className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold"
            style={{ color: domain.color, background: "var(--surface-2)" }}
          >
            <Folder className="size-3.5" strokeWidth={2.2} />
            Général
          </span>
        </div>

        {/* Sujets attachés à la conversation (rien si aucun) */}
        {listenings.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[11.5px] font-semibold text-(--text-tertiary)">
              Suivi dans
            </span>
            {listenings.map((l) => {
              const color = folderVisual(l.folder ?? undefined).color;
              return (
                <Link
                  key={l.subjectId}
                  href={`/sujets/${l.subjectId}?from=${encodeURIComponent(backTo)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--border) px-2 py-0.5 active:opacity-80"
                >
                  <span
                    className="size-2 flex-none rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className={cn(
                      "text-[12.5px] font-semibold",
                      l.active
                        ? "text-(--text-primary)"
                        : "text-(--text-tertiary) line-through decoration-(--text-tertiary)/40",
                    )}
                  >
                    {l.title}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Espace résumé (placeholder — 3 derniers messages, à venir) */}
        <div className="mt-3 rounded-xl border border-(--border) bg-(--surface-2) px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.3px] text-(--text-tertiary) uppercase">
            <Sparkles className="size-3" fill="currentColor" strokeWidth={0} />
            Résumé
          </div>
          <p className="text-[13px] text-(--text-tertiary) italic">
            Pas de résumé disponible pour le moment
          </p>
        </div>

        {/* Menu — Ignorer | Ouvrir un sujet. En sélection WhatsApp : consigne. */}
        {selecting ? (
          <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-(--blue-100) bg-(--blue-50) px-3 py-2.5">
            <Sparkles
              className="size-4 flex-none text-brand"
              strokeWidth={2.2}
            />
            <span className="flex-1 text-[13px] font-semibold text-brand">
              Choisissez le message qui démarre le suivi
            </span>
            <button
              type="button"
              onClick={() => setSelecting(false)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-bold text-(--text-tertiary) active:opacity-70"
            >
              <X className="size-4" strokeWidth={2.4} />
              Annuler
            </button>
          </div>
        ) : (
          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={ignore}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-(--border) bg-white py-2.5 text-[13.5px] font-bold text-(--text-secondary) active:bg-(--surface-2) disabled:opacity-50"
            >
              <EyeOff className="size-[17px]" strokeWidth={2} />
              Ignorer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={openSubject}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2.5 text-[13.5px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-[17px]" strokeWidth={2.2} />
              Ouvrir un sujet
            </button>
          </div>
        )}
      </div>

      <ConversationThread
        messages={messages}
        channelType={channelType}
        selecting={selecting}
        onPick={pickAnchor}
      />
    </>
  );
}
