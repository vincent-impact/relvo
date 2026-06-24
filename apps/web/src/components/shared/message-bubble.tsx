import Link from "next/link";
import { FileText } from "lucide-react";
import type { Actor } from "@relvo/db";
import { cn } from "@/lib/utils";

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
  attachment?: { name: string; label?: string | null } | null;
  /** Si fourni, la bulle est cliquable et mène à la page détail du message. */
  href?: string | null;
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
            {av.letter}
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

      {(() => {
        const boxClass = cn(
          // Les e-mails très longs sont tronqués dans le fil (≈12 lignes) pour ne
          // pas saturer la conversation ; la page détail donne le texte complet.
          "line-clamp-[12] px-3.5 py-[11px] text-[15px] leading-[1.45] whitespace-pre-wrap",
          outgoing
            ? "rounded-[18px_18px_5px_18px] bg-brand text-white"
            : relvo
              ? "rounded-[5px_18px_18px_18px] border border-(--purple-100) bg-relvo-bg text-(--text-primary)"
              : "rounded-[5px_18px_18px_18px] border border-[#ececea] bg-white text-(--text-primary) shadow-(--shadow-card)",
        );
        return data.href ? (
          <Link
            href={data.href}
            className={cn(boxClass, "block active:opacity-90")}
          >
            {data.content}
          </Link>
        ) : (
          <div className={boxClass}>{data.content}</div>
        );
      })()}

      {data.attachment ? (
        <span className="mt-[7px] inline-flex items-center gap-2.5 rounded-xl border border-[#ececea] bg-white px-[11px] py-2 shadow-(--shadow-card)">
          <span className="grid size-[30px] flex-none place-items-center rounded-lg bg-[#f0eeea] text-[#86857d]">
            <FileText className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">
              {data.attachment.name}
            </span>
            {data.attachment.label ? (
              <span className="mt-0.5 inline-block rounded-full bg-(--amber-50) px-[7px] py-px text-[11px] text-(--amber-800)">
                {data.attachment.label}
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}
