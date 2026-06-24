"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Agenda semaine (Accueil, Direction B) — bande horizontale de 7 jours cliquables
// puis la liste des évènements (= tâches datées) du jour SÉLECTIONNÉ. Deux signaux
// distincts sur les chips : « aujourd'hui » = pastille violette pleine ; « jour
// sélectionné » = anneau (ring) violet détaché. Les deux se cumulent sans se
// confondre. Module distinct des cartes (règle « pas de carte blanche sur gris »).

export type AgendaWeekDay = {
  key: string; // ISO date YYYY-MM-DD (UTC, cohérent avec le seed)
  weekday: string;
  day: number;
  longLabel: string; // « Lundi 16 juin » (capitalisé)
  isToday: boolean;
  hasEvents: boolean;
};

export type AgendaEvent = {
  id: string;
  time: string | null;
  color: string;
  title: string;
  sublabel?: string | null;
  href: string;
};

export function AgendaWeek({
  days,
  eventsByDay,
  initialKey,
}: {
  days: AgendaWeekDay[];
  eventsByDay: Record<string, AgendaEvent[]>;
  initialKey: string;
}) {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const selected = days.find((d) => d.key === selectedKey) ?? days[0];
  const events = eventsByDay[selectedKey] ?? [];

  return (
    <div className="pt-1 pb-0.5">
      <div className="flex [scrollbar-width:none] gap-[9px] overflow-x-auto px-[18px] pt-1 pb-1.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => {
          const isSelected = d.key === selectedKey;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedKey(d.key)}
              aria-pressed={isSelected}
              className={cn(
                "w-[50px] flex-none rounded-[15px] pt-[9px] pb-2 text-center transition-shadow",
                d.isToday ? "bg-relvo" : "bg-[#f5f3ef]",
                isSelected &&
                  "ring-2 ring-relvo ring-offset-2 ring-offset-white",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-bold tracking-[0.3px] uppercase",
                  d.isToday ? "text-white/80" : "text-[#a8a69d]",
                )}
              >
                {d.weekday}
              </div>
              <div
                className={cn(
                  "mt-[3px] font-heading text-[20px] font-extrabold",
                  d.isToday ? "text-white" : "text-[#2a2832]",
                )}
              >
                {d.day}
              </div>
              <div
                className={cn(
                  "mx-auto mt-[5px] size-[5px] rounded-full",
                  !d.hasEvents
                    ? "bg-transparent"
                    : d.isToday
                      ? "bg-white"
                      : "bg-brand",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-3.5 pb-0.5">
        <div className="mb-2.5 text-[12.5px] font-bold tracking-[0.3px] text-[#a8a69d] uppercase">
          {selected.isToday ? "Aujourd'hui" : selected.longLabel}
        </div>
        {events.length === 0 ? (
          <p className="py-2 text-[13.5px] text-(--text-tertiary)">
            {selected.isToday
              ? "Rien de prévu aujourd'hui."
              : "Rien de prévu ce jour-là."}
          </p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={e.href}
              className="flex items-center gap-3 py-[9px]"
            >
              <span className="w-[46px] flex-none font-numeric text-[14px] font-semibold text-[#2a2832]">
                {e.time ?? "—"}
              </span>
              <span
                className="h-[30px] w-[3px] flex-none rounded-full"
                style={{ background: e.color }}
              />
              <span className="min-w-0 flex-1 text-[15px] font-semibold">
                {e.title}
                {e.sublabel ? (
                  <small className="mt-px block text-[12.5px] font-medium text-[#9a988f]">
                    {e.sublabel}
                  </small>
                ) : null}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
