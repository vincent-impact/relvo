import Link from "next/link";
import type { Actor } from "@relvo/db";
import { cn } from "@/lib/utils";
import { initialsFor } from "@/lib/display";
import { AttachmentPreview } from "@/components/shared/attachment-preview";
import { LinkifiedText } from "@/components/shared/linkified-text";

// Bulle de message partagée (fil d'un sujet, fil de conversation par contact),
// style « Direction B ». Sortant (Moi) = bulle bleue à droite. Entrant = en-tête
// avatar acteur + nom + canal·heure, bulle blanche (ou violet pâle si Relvo) à
// gauche. Pièce jointe optionnelle (carte fichier + étiquette IA).

export type MessageBubbleData = {
  id: string;
  direction: "incoming" | "outgoing";
  actor: Actor;
  senderName?: string | null;
  channel?: string | null;
  /** Horodatage relatif (« 35 min »), affiché après le canal. */
  time?: string | null;
  content: string;
  /** Corps HTML d'un e-mail (rendu isolé sur la fiche sujet comme dans le fil). */
  contentHtml?: string | null;
  /** `email` | `whatsapp` — décide du rendu (e-mail pleine largeur vs bulle). */
  channelType?: string | null;
  attachment?: {
    id?: string;
    name: string;
    label?: string | null;
    mimeType?: string | null;
  } | null;
  /** Si fourni, la bulle est cliquable et mène à la page détail du message. */
  href?: string | null;
  /** Interlocuteur du message (pour filtrer le fil par conversation) : expéditeur
   *  si entrant, destinataire si sortant. */
  senderContactId?: string | null;
  recipientContactId?: string | null;
};

const AVATAR: Record<Actor, { letter: string; bg: string }> = {
  user: { letter: "M", bg: "bg-brand" },
  ai: { letter: "R", bg: "bg-relvo" },
  contact: { letter: "E", bg: "bg-(--amber-600)" },
  system: { letter: "R", bg: "bg-relvo" },
};

export function MessageBubble({ data }: { data: MessageBubbleData }) {
  const outgoing = data.direction === "outgoing";
  const relvo = data.actor === "ai" || data.actor === "system";
  const av = AVATAR[data.actor];
  // Un contact externe montre ses INITIALES (ex. « LF »), cohérent avec le
  // composer ; la couleur (ambre) porte toujours l'acteur. Moi/Relvo gardent M/R.
  // Sans nom lisible (numéro/email brut) → on retombe sur « E ».
  const avatarText =
    data.actor === "contact"
      ? (initialsFor(data.senderName) ?? av.letter)
      : av.letter;

  return (
    <div
      className={cn("max-w-[86%]", outgoing ? "self-end" : "w-full self-start")}
    >
      {!outgoing ? (
        <div className="mb-1.5 flex items-center gap-[7px]">
          <span
            className={cn(
              "grid size-[22px] flex-none place-items-center rounded-full text-[10px] font-extrabold text-white",
              av.bg,
            )}
          >
            {avatarText}
          </span>
          <span className="text-[12.5px] font-bold">
            {data.senderName ?? "Externe"}
          </span>
          {data.channel || data.time ? (
            <span className="text-[11.5px] whitespace-nowrap text-[#a8a69d]">
              {[data.channel, data.time].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Bulle texte — masquée si le message n'a QUE une pièce jointe (ex. photo
          WhatsApp sans légende) : pas de bulle vide au-dessus de la miniature. */}
      {data.content.trim()
        ? (() => {
            const boxClass = cn(
              // Les e-mails très longs sont tronqués dans le fil (≈12 lignes) pour
              // ne pas saturer la conversation ; la page détail donne le texte
              // complet. `overflow-wrap:anywhere` : une URL interminable se coupe
              // au lieu d'élargir l'écran (jamais de scroll horizontal).
              "line-clamp-[12] px-3.5 py-[11px] text-[15px] leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere]",
              outgoing
                ? "rounded-[18px_18px_5px_18px] bg-brand text-white"
                : relvo
                  ? "rounded-[5px_18px_18px_18px] border border-(--purple-100) bg-relvo-bg text-(--text-primary)"
                  : "rounded-[5px_18px_18px_18px] border border-[#ececea] bg-white text-(--text-primary) shadow-(--shadow-card)",
            );
            // Bulle cliquable (→ page détail) : pas de lien imbriqué, on garde le
            // texte brut. Sinon on rend les URLs cliquables directement.
            return data.href ? (
              <Link
                href={data.href}
                className={cn(boxClass, "block active:opacity-90")}
              >
                {data.content}
              </Link>
            ) : (
              <div className={boxClass}>
                <LinkifiedText text={data.content} />
              </div>
            );
          })()
        : null}

      {data.attachment ? (
        <AttachmentPreview
          attachment={data.attachment}
          className={data.content.trim() ? "mt-[7px]" : undefined}
        />
      ) : null}
    </div>
  );
}
