"use client";

import { Circle } from "lucide-react";
import { EmailMessage } from "@/components/conversations/email-message";
import { MessageBubble } from "@/components/shared/message-bubble";
import { WhatsAppMessageRow } from "@/components/conversations/whatsapp-message-row";
import type { ThreadMessageData } from "@/lib/conversation-row";

// Fil d'une conversation (M6ter, invariant n°13bis) — timeline chronologique.
// Le signal d'appartenance (« Suivi dans ») remonte désormais dans le HEADER
// enrichi de la conversation (ConversationDetail) ; ce composant ne rend plus
// que les messages.
//
// ── On diverge sur le RENDU, jamais sur le domaine ───────────────────────────
//   • email    → PLEINE LARGEUR (EmailMessage), pas de bulle.
//   • WhatsApp → BULLES conservées (MessageBubble).
//
// ── Mode SÉLECTION (WhatsApp uniquement) ─────────────────────────────────────
// Quand l'utilisateur lance « Ouvrir un sujet » sur un fil WhatsApp, on n'ouvre
// PAS un nouvel écran : chaque message reçoit une pastille à cocher, et le tap
// démarre l'écoute à partir de ce message (invariant n°8, geste « swipe droite »
// exprimé ici en sélection explicite). Le swipe est désactivé pendant ce mode.

export function ConversationThread({
  messages,
  channelType,
  selecting = false,
  onPick,
}: {
  messages: ThreadMessageData[];
  channelType: string;
  /** Mode sélection d'un message de départ (WhatsApp) — pose des pastilles. */
  selecting?: boolean;
  /** Message choisi comme point de départ de l'écoute. */
  onPick?: (messageId: string) => void;
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

  return (
    <div className="flex flex-col pt-1.5 pb-3">
      {empty}
      {messages.map((m) =>
        selecting ? (
          // Ligne SÉLECTIONNABLE : pastille + bulle (inerte au tap, l'action
          // vit sur le bouton parent). Tap = démarrer l'écoute ici.
          <button
            key={m.id}
            type="button"
            onClick={() => onPick?.(m.id)}
            className="flex w-full items-start gap-2.5 px-[18px] py-[7px] text-left active:bg-(--surface-2)"
          >
            <Circle
              className="mt-3 size-5 flex-none text-brand"
              strokeWidth={2}
            />
            <div className="pointer-events-none min-w-0 flex-1">
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
            </div>
          </button>
        ) : (
          <WhatsAppMessageRow key={m.id} data={m} />
        ),
      )}
    </div>
  );
}
