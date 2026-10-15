import type { Actor } from "@relvo/db";
import { ListPanel } from "@/components/shared/list-panel";
import { formatRelative } from "@/lib/display";
import { cn } from "@/lib/utils";

// Onglet « Journal » de la fiche Sujet — le dernier onglet (2026-09-15) : on
// ne l'ouvre que pour comprendre ce que Relvo a fait, jamais pour agir. Une
// ligne par événement dans UNE carte (02-composants), la lettre de l'acteur
// dans son disque (le triptyque Moi / Relvo / Externe, lisible au soleil là
// où un point de couleur ne l'était pas), le moment à droite.

export type JournalEvent = {
  id: string;
  title: string;
  actor: Actor;
  createdAt: Date;
};

const ACTOR_DISC: Record<Actor, { letter: string; className: string }> = {
  user: { letter: "M", className: "bg-actor-me text-white" },
  ai: { letter: "R", className: "bg-relvo text-white" },
  contact: { letter: "E", className: "bg-actor-ext-fond text-actor-ext" },
  system: { letter: "R", className: "bg-relvo text-white" },
};

export function JournalPane({ events }: { events: JournalEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
        Rien dans le journal pour l’instant.
      </p>
    );
  }
  return (
    <div className="pt-3 pb-2">
      <ListPanel>
        {events.map((ev) => {
          const disc = ACTOR_DISC[ev.actor];
          return (
            <div
              key={ev.id}
              data-list-row
              className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5"
            >
              <span
                aria-label={
                  ev.actor === "user"
                    ? "Moi"
                    : ev.actor === "contact"
                      ? "Externe"
                      : "Relvo"
                }
                className={cn(
                  "chiffre grid size-[22px] flex-none place-items-center rounded-full text-[11px]",
                  disc.className,
                )}
              >
                {disc.letter}
              </span>
              <div className="min-w-0 flex-1 text-[14px] leading-[18px] font-normal text-noir">
                {ev.title}
              </div>
              <span className="chiffre flex-none text-[12px] text-gris">
                {formatRelative(ev.createdAt)}
              </span>
            </div>
          );
        })}
      </ListPanel>
    </div>
  );
}
