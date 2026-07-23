"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder, Mail, MessageCircle, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { ConversationListening } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  createSubjectFromConversationAction,
  ignoreConversationAction,
} from "@/server/actions/conversations";
import { createSubjectFromMessageAction } from "@/server/actions/messages";
import { folderVisual } from "@/lib/folders";
import { initialsFor } from "@/lib/display";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// Détail d'une conversation (header enrichi 2026-07-23, v2). TOUT le contexte —
// interlocuteur, canal + boîte, domaine, sujets suivis, résumé — vit DANS le
// hero violet (RelvoHeader children). Le dock 4-icônes cède la place, en bas, à
// DEUX boutons d'action : « Ignorer » (rouge) / « Ouvrir un sujet » (bleu).
//
// « Ouvrir un sujet » :
//   • email    → le fil EST le sujet → création immédiate sur tout le fil ;
//   • WhatsApp → mode SÉLECTION in-place (pastille par message) : le message
//     choisi démarre l'écoute. Le bas de page devient alors la consigne + Annuler.

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

export function ConversationDetail({
  conversationId,
  title,
  channelType,
  channelName,
  interlocutorName,
  isGroup,
  listenings,
  messages,
  backTo,
}: {
  conversationId: string;
  title: string;
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
      <Screen>
        <RelvoHeader
          back={backTo}
          relvo={false}
          titleFull
          title={title}
          className="pb-6"
        >
          <div className="space-y-3 px-[22px] pt-3.5">
            {/* Interlocuteur + canal + domaine (sur fond violet) */}
            <div className="flex items-center gap-2.5">
              <span className="grid size-[38px] flex-none place-items-center rounded-full bg-white/20 text-[13px] font-extrabold text-white">
                {isGroup ? (
                  <Users className="size-[18px]" strokeWidth={2.2} />
                ) : (
                  (initials ?? "?")
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-white">
                  {senderLabel}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-(--on-violet)">
                  <ChannelIcon
                    className="size-[13px] flex-none"
                    strokeWidth={2}
                  />
                  <span className="truncate">{channelName}</span>
                </div>
              </div>
              {/* Domaine détecté par Relvo (placeholder « Général ») */}
              <span className="inline-flex flex-none items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2 py-1 text-[11px] font-bold text-white">
                <Folder className="size-3.5" strokeWidth={2.2} />
                Général
              </span>
            </div>

            {/* Sujets suivis (rien si aucun) */}
            {listenings.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="text-[11.5px] font-semibold text-(--on-violet)">
                  Suivi dans
                </span>
                {listenings.map((l) => {
                  const color = folderVisual(l.folder ?? undefined).color;
                  return (
                    <Link
                      key={l.subjectId}
                      href={`/sujets/${l.subjectId}?from=${encodeURIComponent(backTo)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2 py-0.5 active:opacity-80"
                    >
                      <span
                        className="size-2 flex-none rounded-full"
                        style={{ background: color }}
                      />
                      <span
                        className={cn(
                          "text-[12.5px] font-semibold text-white",
                          !l.active && "line-through decoration-white/40",
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
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.3px] text-(--on-violet) uppercase">
                <Sparkles
                  className="size-3"
                  fill="currentColor"
                  strokeWidth={0}
                />
                Résumé
              </div>
              <p className="text-[13px] text-white/75 italic">
                Pas de résumé disponible pour le moment
              </p>
            </div>
          </div>
        </RelvoHeader>

        <ConversationThread
          messages={messages}
          channelType={channelType}
          selecting={selecting}
          onPick={pickAnchor}
        />
      </Screen>

      {/* Bas de page ANCRÉ (remplace le dock sur cet écran). Deux modes :
          sélection WhatsApp (consigne + Annuler) ou boutons d'action. */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 border-t border-(--border) bg-white px-4 pt-2.5"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        {selecting ? (
          <div className="flex items-center gap-2 py-0.5">
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
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[12.5px] font-bold text-(--text-tertiary) active:opacity-70"
            >
              <X className="size-4" strokeWidth={2.4} />
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={ignore}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-accent py-2.5 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              Ignorer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={openSubject}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2.5 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-[17px]" strokeWidth={2.2} />
              Ouvrir un sujet
            </button>
          </div>
        )}
      </div>
    </>
  );
}
