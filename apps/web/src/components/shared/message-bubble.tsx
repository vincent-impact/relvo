import { FileText } from "lucide-react";
import type { Actor } from "@relvo/db";
import { cn } from "@/lib/utils";
import { ActorPill } from "./actor-pill";

// Bulle de message partagée (fil d'un sujet, fil de conversation par contact).
// Sortant (Moi) = aligné à droite, fond bleu. Entrant (Externe/Relvo) = aligné
// à gauche avec en-tête acteur + canal. Pièce jointe optionnelle.

export type MessageBubbleData = {
  id: string;
  direction: "incoming" | "outgoing";
  actor: Actor;
  senderName?: string | null;
  channel?: string | null;
  content: string;
  attachment?: { name: string; label?: string | null } | null;
};

export function MessageBubble({ data }: { data: MessageBubbleData }) {
  const outgoing = data.direction === "outgoing";

  return (
    <div
      className={cn("max-w-[86%]", outgoing ? "self-end" : "w-full self-start")}
    >
      {!outgoing ? (
        <div className="mb-1.5 flex items-center gap-1.5">
          <ActorPill actor={data.actor} label={data.senderName ?? undefined} />
          {data.channel ? (
            <span className="text-[11px] text-(--text-tertiary)">
              {data.channel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "px-3.5 py-2.5 text-[14.5px]",
          outgoing
            ? "rounded-[16px_16px_4px_16px] bg-brand text-white"
            : "rounded-[4px_16px_16px_16px] border border-(--border-light) bg-white text-(--text-primary) shadow-(--shadow-card)",
        )}
      >
        {data.content}
      </div>

      {data.attachment ? (
        <span className="mt-1.5 inline-flex items-center gap-2.5 rounded-lg border border-(--border-light) bg-white px-2.5 py-2 shadow-(--shadow-card)">
          <span className="grid size-[30px] flex-none place-items-center rounded-md bg-(--surface-2) text-(--text-secondary)">
            <FileText className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">
              {data.attachment.name}
            </span>
            {data.attachment.label ? (
              <span className="mt-0.5 inline-block rounded-full bg-(--amber-50) px-2 py-px text-[11px] text-(--amber-800)">
                {data.attachment.label}
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}
