import type { ConversationListening } from "@relvo/db";
import { EmailMessage } from "@/components/conversations/email-message";
import { FollowedInBanner } from "@/components/conversations/followed-in-banner";
import { WhatsAppMessageRow } from "@/components/conversations/whatsapp-message-row";
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

  const empty =
    messages.length === 0 ? (
      <p className="py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun message dans cette conversation.
      </p>
    ) : null;

  return (
    <>
      <FollowedInBanner listenings={listenings} backTo={backTo} />

      {isEmail ? (
        // Email — conteneur paddé, messages pleine largeur (pas de geste ici :
        // on ouvre un sujet email depuis la CONVERSATION, dans la liste).
        <div className="flex flex-col gap-2.5 px-[18px] pt-3.5 pb-3">
          {empty}
          {messages.map((m) => (
            <EmailMessage key={m.id} data={m} />
          ))}
        </div>
      ) : (
        // WhatsApp — chaque message est une ligne pleine largeur (fond de swipe
        // bord à bord), swipe droite = ouvrir/étendre l'écoute sur ce message.
        <div className="flex flex-col pt-1.5 pb-3">
          {empty}
          {messages.map((m) => (
            <WhatsAppMessageRow key={m.id} data={m} />
          ))}
        </div>
      )}
    </>
  );
}
