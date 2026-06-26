"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Ajout de tâche (onglet Tâches de la fiche Sujet) — « + Ajouter une tâche » ouvre
// une MODALE identique à l'édition (titre + DATE/heure), pour une UX cohérente
// d'un bout à l'autre. La date (= deadline, startDate/startTime, cf. 02-modele §9)
// alimente l'agenda (un évènement = une tâche datée). sourceActor = user.

export function AddTask({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD ou ""
  const [time, setTime] = useState(""); // HH:MM ou ""
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTitle("");
      setDate("");
      setTime("");
    }
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Le titre est requis.");
      return;
    }
    const startDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    const startTime = date && time ? new Date(`${date}T${time}:00.000Z`) : null;
    startTransition(async () => {
      const res = await createTaskAction({
        subjectId,
        title: trimmed,
        sourceActor: "user",
        ...(startDate ? { startDate } : {}),
        ...(startTime ? { startTime } : {}),
      });
      if (res.ok) {
        toast.success("Tâche ajoutée");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-[14px] mt-1 flex items-center gap-2.5 px-[18px] py-3.5 text-[14px] font-bold text-relvo"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-bg">
          <Plus className="size-[15px]" strokeWidth={2.6} />
        </span>
        Ajouter une tâche
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
          </DialogHeader>

          <input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Intitulé de la tâche"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-relvo"
          />

          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5">
              <CalendarDays
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </label>
            <label
              className={cn(
                "flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5",
                !date && "opacity-50",
              )}
            >
              <Clock
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                type="time"
                value={time}
                disabled={!date}
                onChange={(e) => setTime(e.target.value)}
                className="w-[72px] bg-transparent text-[14px] outline-none"
              />
            </label>
          </div>
          {date ? (
            <button
              type="button"
              onClick={() => {
                setDate("");
                setTime("");
              }}
              className="-mt-1 self-start text-[12.5px] font-semibold text-(--text-tertiary)"
            >
              Retirer la date
            </button>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            Ajouter la tâche
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
