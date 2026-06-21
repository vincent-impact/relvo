import { Calendar, Check } from "lucide-react";
import type { Actor, TaskStatus } from "@relvo/db";
import { cn } from "@/lib/utils";
import { ActorPill } from "./actor-pill";

// Carte-tâche partagée (onglet Tâches d'un sujet, generative UI). La case à
// cocher est rendue ici mais l'interactivité (complétion) est câblée par le
// parent via `checkbox` (ex. un bouton de Server Action) — défaut : statique.

export type TaskCardData = {
  id: string;
  title: string;
  status: TaskStatus;
  sourceActor: Actor;
  /** Libellé de date (« aujourd'hui », « 18 juin »…). */
  dateLabel?: string | null;
};

export function TaskCard({
  data,
  checkbox,
}: {
  data: TaskCardData;
  /** Override de la case (ex. bouton Server Action). Défaut : case statique. */
  checkbox?: React.ReactNode;
}) {
  const done = data.status === "done";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-(--border-light) bg-white p-3 shadow-(--shadow-card)">
      {checkbox ?? (
        <span
          className={cn(
            "mt-px grid size-[22px] flex-none place-items-center rounded-md border-2",
            done
              ? "border-(--green-600) bg-(--green-600) text-white"
              : "border-(--border) text-transparent",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[14.5px] font-semibold",
            done && "text-(--text-tertiary) line-through",
          )}
        >
          {data.title}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-(--text-tertiary)">
          <ActorPill actor={data.sourceActor} />
          {data.dateLabel ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" strokeWidth={2} />
              {data.dateLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
