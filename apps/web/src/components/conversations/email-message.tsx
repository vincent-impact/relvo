import { AttachmentPreview } from "@/components/shared/attachment-preview";
import { LinkifiedText } from "@/components/shared/linkified-text";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { initialsFor } from "@/lib/display";
import { cn } from "@/lib/utils";

// Rendu d'un message EMAIL dans le fil (M6ter, invariant n°13bis) — PLEINE
// LARGEUR, jamais une bulle. Un email est long et structuré ; la bulle
// l'étrangle (cf. Gmail/Superhuman/Outlook). C'est l'EN-TÊTE qui porte
// l'information (avatar + expéditeur + date), le sortant se signalant par « Moi »
// et une teinte TRÈS légère — le texte reste sur fond clair dans les deux sens.

export function EmailMessage({ data }: { data: ThreadMessageData }) {
  const outgoing = data.direction === "outgoing";
  const senderName = outgoing ? "Moi" : (data.senderName ?? "Externe");
  const initials = outgoing ? "M" : (initialsFor(data.senderName) ?? "E");

  return (
    <article
      className={cn(
        "rounded-[14px] border px-4 py-3.5",
        // Repli assumé de l'invariant : teinte très légère au SORTANT seulement,
        // pour distinguer « Moi » sans jamais teinter du texte long.
        outgoing
          ? "border-(--blue-100) bg-(--blue-50)"
          : "border-[#ececea] bg-white shadow-(--shadow-card)",
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "grid size-[26px] flex-none place-items-center rounded-full text-[10.5px] font-extrabold text-white",
            outgoing ? "bg-brand" : "bg-(--amber-600)",
          )}
        >
          {initials}
        </span>
        <span className="text-[13px] font-bold text-(--text-primary)">
          {senderName}
        </span>
        {data.time ? (
          <span className="ml-auto text-[11.5px] whitespace-nowrap text-[#a8a69d]">
            {data.time}
          </span>
        ) : null}
      </header>

      {data.content.trim() ? (
        <div className="text-[15px] leading-[1.5] [overflow-wrap:anywhere] whitespace-pre-wrap text-(--text-primary)">
          <LinkifiedText text={data.content} />
        </div>
      ) : null}

      {data.attachment ? (
        <AttachmentPreview
          attachment={data.attachment}
          className={data.content.trim() ? "mt-2.5" : undefined}
        />
      ) : null}
    </article>
  );
}
