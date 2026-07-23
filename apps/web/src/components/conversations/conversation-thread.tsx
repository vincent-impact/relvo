"use client";

import { Check } from "lucide-react";
import { EmailMessage } from "@/components/conversations/email-message";
import { MessageBubble } from "@/components/shared/message-bubble";
import { cn } from "@/lib/utils";
import type { ThreadMessageData } from "@/lib/conversation-row";

// Fil d'une conversation (M6ter, invariant n°13bis) — timeline chronologique.
//
// ── On diverge sur le RENDU, jamais sur le domaine ───────────────────────────
//   • email    → PLEINE LARGEUR (EmailMessage), pas de bulle.
//   • WhatsApp → BULLES conservées.
//
// ── Mode SÉLECTION (WhatsApp, 2026-07-23) ────────────────────────────────────
// « Ouvrir/Lier un sujet » depuis le dock passe le fil en sélection : chaque
// message reçoit une pastille. Dès qu'on en choisit un, un CORDON VIOLET relie ce
// message jusqu'au DERNIER — l'utilisateur voit que toute la suite de la
// conversation sera écoutée. Le dock demande alors de VALIDER. Le TAP hors
// sélection reste réservé aux pièces jointes (aucune pop-up de message).

function Bubble({ m }: { m: ThreadMessageData }) {
  return (
    <MessageBubble
      data={{
        id: m.id,
        direction: m.direction,
        actor: m.direction === "outgoing" ? "user" : "contact",
        senderName: m.senderName,
        time: m.time,
        content: m.content,
        attachment: m.attachment,
      }}
    />
  );
}

export function ConversationThread({
  messages,
  channelType,
  selecting = false,
  selectedMessageId = null,
  onSelect,
}: {
  messages: ThreadMessageData[];
  channelType: string;
  /** Mode sélection d'un message de départ (WhatsApp). */
  selecting?: boolean;
  /** Message choisi comme départ de l'écoute (début du cordon). */
  selectedMessageId?: string | null;
  onSelect?: (messageId: string) => void;
}) {
  const isEmail = channelType === "email";

  const empty =
    messages.length === 0 ? (
      <p className="py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun message dans cette conversation.
      </p>
    ) : null;

  if (isEmail) {
    return (
      <div className="flex flex-col gap-2.5 px-2.5 pt-3.5 pb-3">
        {empty}
        {messages.map((m) => (
          <EmailMessage key={m.id} data={m} />
        ))}
      </div>
    );
  }

  if (!selecting) {
    return (
      <div className="flex flex-col pt-1.5 pb-3">
        {empty}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col px-[18px] py-[7px]">
            <Bubble m={m} />
          </div>
        ))}
      </div>
    );
  }

  // Sélection WhatsApp : rail à pastilles + cordon violet du message choisi
  // jusqu'au dernier (in-range = index ≥ index du message sélectionné).
  const selectedIndex = selectedMessageId
    ? messages.findIndex((m) => m.id === selectedMessageId)
    : -1;
  const lastIndex = messages.length - 1;

  return (
    <div className="flex flex-col pt-1.5 pb-3">
      {empty}
      {messages.map((m, i) => {
        const inRange = selectedIndex >= 0 && i >= selectedIndex;
        const isSelected = i === selectedIndex;
        const lineTop = inRange && i > selectedIndex;
        const lineBottom = inRange && i < lastIndex;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect?.(m.id)}
            className="flex w-full items-stretch gap-2 px-3.5 py-[7px] text-left active:bg-(--surface-2)"
          >
            {/* Rail : cordon + pastille */}
            <span className="relative flex w-6 flex-none items-center justify-center self-stretch">
              {lineTop ? (
                <span className="absolute top-0 left-1/2 h-1/2 w-[3px] -translate-x-1/2 bg-relvo" />
              ) : null}
              {lineBottom ? (
                <span className="absolute bottom-0 left-1/2 h-1/2 w-[3px] -translate-x-1/2 bg-relvo" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-[18px] place-items-center rounded-full",
                  inRange
                    ? "bg-relvo text-white ring-2 ring-white"
                    : "border-2 border-(--text-tertiary) bg-white",
                )}
              >
                {isSelected ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : null}
              </span>
            </span>

            <span className="pointer-events-none min-w-0 flex-1">
              <Bubble m={m} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
