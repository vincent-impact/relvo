"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Ajout de tâche en ligne (onglet Tâches de la fiche Sujet, cf. .addtask du DS) :
// « + Ajouter une tâche » révèle un champ ; Entrée ou « Ajouter » crée la tâche
// (sourceActor = user) puis rafraîchit. La date (= deadline, startDate/startTime,
// cf. 02-modele §9) se pose via des chips rapides « Aujourd'hui / Demain / 📅 » +
// une heure optionnelle. Une tâche datée alimente l'agenda (un évènement = une
// tâche avec une date). Pattern « + Ajouter… » de la Direction B.

/** Date ISO YYYY-MM-DD à `offset` jours d'aujourd'hui (UTC, cohérent agenda). */
function isoDay(offset: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offset,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export function AddTask({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [date, setDate] = useState<string | null>(null); // YYYY-MM-DD ou null
  const [time, setTime] = useState(""); // HH:MM ou ""
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function reset() {
    setValue("");
    setDate(null);
    setTime("");
    setOpen(false);
  }

  function submit() {
    const title = value.trim();
    if (!title) return;
    const startDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    const startTime = date && time ? new Date(`${date}T${time}:00.000Z`) : null;
    startTransition(async () => {
      const res = await createTaskAction({
        subjectId,
        title,
        sourceActor: "user",
        ...(startDate ? { startDate } : {}),
        ...(startTime ? { startTime } : {}),
      });
      if (res.ok) {
        reset();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => ref.current?.focus());
        }}
        className="mx-[14px] mt-1 flex items-center gap-2.5 px-[18px] py-3.5 text-[14px] font-bold text-relvo"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-bg">
          <Plus className="size-[15px]" strokeWidth={2.6} />
        </span>
        Ajouter une tâche
      </button>
    );
  }

  const isToday = date === isoDay(0);
  const isTomorrow = date === isoDay(1);
  const isCustom = date !== null && !isToday && !isTomorrow;

  return (
    <div className="mx-[14px] px-[18px] pt-2 pb-1">
      <div className="flex gap-2">
        <input
          ref={ref}
          type="text"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") reset();
          }}
          placeholder="Nouvelle tâche…"
          className="min-w-0 flex-1 rounded-xl border border-(--border) px-3 py-[11px] text-[14px] outline-none focus:border-relvo focus:shadow-[0_0_0_3px_var(--relvo-bg)]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-none rounded-xl bg-relvo px-4 text-[13px] font-bold text-white disabled:opacity-60"
        >
          Ajouter
        </button>
      </div>

      {/* Chips de date (deadline). Re-cliquer une chip active la désélectionne. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <DateChip
          active={isToday}
          onClick={() => setDate(isToday ? null : isoDay(0))}
        >
          Aujourd’hui
        </DateChip>
        <DateChip
          active={isTomorrow}
          onClick={() => setDate(isTomorrow ? null : isoDay(1))}
        >
          Demain
        </DateChip>
        <button
          type="button"
          onClick={() => dateRef.current?.showPicker?.()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
            isCustom
              ? "border-relvo bg-relvo text-white"
              : "border-(--border) bg-white text-(--text-secondary)",
          )}
        >
          <CalendarDays className="size-[15px]" strokeWidth={2} />
          {isCustom
            ? new Date(`${date}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })
            : "Date…"}
        </button>
        {/* Input date natif déclenché par la chip (showPicker), invisible. */}
        <input
          ref={dateRef}
          type="date"
          value={isCustom ? date : ""}
          onChange={(e) => setDate(e.target.value || null)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        {date ? (
          <>
            <label className="inline-flex items-center gap-1.5 rounded-full border border-(--border) bg-white px-3 py-1.5 text-[13px] font-semibold text-(--text-secondary) focus-within:border-relvo">
              <Clock className="size-[15px]" strokeWidth={2} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-[68px] bg-transparent text-[13px] outline-none"
              />
            </label>
            <button
              type="button"
              aria-label="Retirer la date"
              onClick={() => {
                setDate(null);
                setTime("");
              }}
              className="grid size-7 place-items-center rounded-full text-(--text-tertiary) hover:bg-(--surface)"
            >
              <X className="size-4" strokeWidth={2.2} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DateChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
        active
          ? "border-relvo bg-relvo text-white"
          : "border-(--border) bg-white text-(--text-secondary)",
      )}
    >
      {children}
    </button>
  );
}
