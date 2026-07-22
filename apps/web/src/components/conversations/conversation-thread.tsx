import type { ConversationListening } from "@relvo/db";
import { EmailMessage } from "@/components/conversations/email-message";
import { FollowedInBanner } from "@/components/conversations/followed-in-banner";
import { MessageBubble } from "@/components/shared/message-bubble";
import type { ThreadMessageData } from "@/lib/conversation-row";

// Fil d'une conversation (M6ter, invariant n°13bis) — timeline chronologique.
//
// ── Le cordon a DISPARU ──────────────────────────────────────────────────────
// Une conversation est désormais soit ÉCOUTÉE par un sujet ouvert, soit pas :
// binaire. Un rail qui alternait des couleurs par message n'avait plus rien à
// montrer. Le signal d'appartenance remonte dans le BANDEAU « Suivi dans : … »
// en tête de fil (les deux canaux). L'entrelacement dans une plage d'écoute n'est
// plus exprimé dans l'UI — c'est le travail de M7 ; en attendant, un peu de bruit
// vaut mieux qu'une interface incompréhensible.
//
// ── On diverge sur le RENDU, jamais sur le domaine ───────────────────────────
//   • email    → PLEINE LARGEUR (EmailMessage), pas de bulle : un email est long
//     et structuré, la bulle l'étrangle.
//   • WhatsApp → BULLES conservées (MessageBubble).
//
// Le TAP est réservé à l'ouverture des pièces jointes (géré par AttachmentPreview
// à l'intérieur de chaque message) : plus aucune pop-up de message, sur aucun
// canal.

export function ConversationThread({
  messages,
  channelType,
  listenings,
  backTo,
}: {
  messages: ThreadMessageData[];
  channelType: string;
  listenings: ConversationListening[];
  backTo: string;
}) {
  const isEmail = channelType === "email";

  return (
    <>
      <FollowedInBanner listenings={listenings} backTo={backTo} />

      <div
        className={
          isEmail
            ? "flex flex-col gap-2.5 px-[18px] pt-3.5 pb-3"
            : "flex flex-col gap-[15px] px-[18px] pt-4 pb-3"
        }
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-(--text-tertiary)">
            Aucun message dans cette conversation.
          </p>
        ) : null}

        {messages.map((m) =>
          isEmail ? (
            <EmailMessage key={m.id} data={m} />
          ) : (
            <MessageBubble
              key={m.id}
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
          ),
        )}
      </div>
    </>
  );
}
