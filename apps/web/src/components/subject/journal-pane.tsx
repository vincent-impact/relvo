import type { Actor } from "@relvo/db";
import { formatRelative } from "@/lib/display";
import { cn } from "@/lib/utils";

// Onglet « Journal » de la fiche Sujet — le dernier onglet (2026-09-15) : on
// ne l'ouvre que pour comprendre ce que Relvo a fait, jamais pour agir. Une
// ligne par événement, point de couleur par acteur.

export type JournalEvent = {
  id: string;
  title: string;
  actor: Actor;
  createdAt: Date;
};

const ACTOR_DOT: Record<Actor, string> = {
  user: "bg-brand",
  ai: "bg-relvo",
  contact: "bg-(--amber-600)",
  system: "bg-(--text-tertiary)",
};

export function JournalPane({ events }: { events: JournalEvent[] }) {
  return (
    <div className="px-4 pt-4 pb-2">
      {events.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-(--text-tertiary)">
          Journal vide.
        </p>
      ) : (
        <div className="rounded-[14px] border border-(--hairline) bg-white px-4 pt-4 pb-1 shadow-surface-1">
          {events.map((ev, i) => (
            <div key={ev.id} className="relative flex gap-[13px] pb-[17px]">
              <span
                className={cn(
                  "z-[1] mt-[3px] size-[11px] flex-none rounded-full border-2 border-white",
                  ACTOR_DOT[ev.actor],
                )}
              />
              {i < events.length - 1 ? (
                <span className="absolute top-[13px] -bottom-1 left-[5px] w-0.5 bg-[#ece9e3]" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] leading-[1.4] text-[#3a3833]">
                  {ev.title}
                </div>
                <div className="mt-[3px] text-[11.5px] text-[#a8a69d]">
                  {formatRelative(ev.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
