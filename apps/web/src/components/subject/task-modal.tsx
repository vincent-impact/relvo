"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Actor } from "@relvo/db";
import { ActorPill } from "@/components/shared/actor-pill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listSubjectOptionsAction } from "@/server/actions/subjects";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { folderColor } from "@/lib/display";
import { cn } from "@/lib/utils";

// Modale d'une tâche — PARTAGÉE entre édition (TaskItem) et création (bouton +
// de l'Accueil). Champs : titre, date/heure, et SUJET rattaché (affiché + (re)
// assignable, ou détaché — une tâche peut ne pas avoir de sujet). Le créateur
// (Relvo/Moi) est rappelé ici (retiré des lignes pour ne pas les surcharger).

type SubjectOption = {
  id: string;
  reference: string;
  title: string;
  folderSlug: string | null;
};

export function TaskModal({
  open,
  onOpenChange,
  mode,
  taskId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "edit" | "create";
  taskId?: string;
  initial: {
    title?: string;
    date?: string | null;
    time?: string | null;
    subjectId?: string | null;
    subjectTitle?: string | null;
    subjectFolderSlug?: string | null;
    sourceActor?: Actor;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.title ?? "");
  const [date, setDate] = useState(initial.date ?? "");
  const [time, setTime] = useState(initial.time ?? "");
  const [subjectId, setSubjectId] = useState<string | null>(
    initial.subjectId ?? null,
  );
  const [subjectTitle, setSubjectTitle] = useState<string | null>(
    initial.subjectTitle ?? null,
  );
  const [folderSlug, setFolderSlug] = useState<string | null>(
    initial.subjectFolderSlug ?? null,
  );

  // Sélecteur de sujet (chargé à la 1ʳᵉ ouverture).
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SubjectOption[] | null>(null);

  // « Enregistrer » n'est actif QUE si quelque chose a changé (édition) — incite à
  // sauvegarder avant de quitter, et évite un écrit inutile. En création, toujours
  // actif (la validation du titre se fait au clic).
  const dirty =
    mode === "create" ||
    title !== (initial.title ?? "") ||
    date !== (initial.date ?? "") ||
    time !== (initial.time ?? "") ||
    subjectId !== (initial.subjectId ?? null);

  // La modale est montée à la demande (parent : `{open && <TaskModal/>}`) → l'état
  // repart toujours de `initial` à l'ouverture, sans effet (création = champs
  // vides ; annuler une édition = valeurs d'origine).

  function openPicker() {
    setPicking((p) => !p);
    setQuery("");
    if (options === null) {
      void listSubjectOptionsAction().then((res) => {
        if (res.ok) setOptions(res.data);
      });
    }
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Le titre est requis.");
      return;
    }
    const startDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    const startTime = date && time ? new Date(`${date}T${time}:00.000Z`) : null;
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createTaskAction({
              title: trimmed,
              sourceActor: "user",
              subjectId,
              startDate,
              startTime,
            })
          : await updateTaskAction(taskId!, {
              title: trimmed,
              subjectId,
              startDate,
              startTime,
            });
      if (res.ok) {
        toast.success(mode === "create" ? "Tâche créée" : "Tâche mise à jour");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function remove() {
    if (!taskId) return;
    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (res.ok) {
        toast.success("Tâche supprimée");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const filtered = (options ?? []).filter((o) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      o.title.toLowerCase().includes(q) ||
      o.reference.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouvelle tâche" : "Modifier la tâche"}
          </DialogTitle>
        </DialogHeader>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Intitulé de la tâche"
          autoFocus={mode === "create"}
          className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-relvo"
        />

        {/* Sujet rattaché — affiché + (ré)assignable / détachable. */}
        <div className="min-w-0">
          <div className="mb-1.5 text-[12px] font-bold tracking-[0.4px] text-(--text-tertiary) uppercase">
            Sujet
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5 text-left"
            >
              {subjectId ? (
                <span
                  aria-hidden
                  className="size-2.5 flex-none rounded-full"
                  style={{ background: folderColor(folderSlug) }}
                />
              ) : null}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[14px]",
                  subjectTitle
                    ? "font-semibold"
                    : "text-(--text-tertiary) italic",
                )}
              >
                {subjectTitle ?? "Aucun sujet"}
              </span>
              <span className="flex-none text-[12.5px] font-bold text-relvo">
                {picking ? "Fermer" : "Changer"}
              </span>
            </button>
            {subjectId ? (
              <button
                type="button"
                onClick={() => {
                  setSubjectId(null);
                  setSubjectTitle(null);
                  setFolderSlug(null);
                }}
                aria-label="Détacher le sujet"
                className="grid size-[42px] flex-none place-items-center rounded-xl border border-(--border) text-(--text-tertiary)"
              >
                <X className="size-[18px]" strokeWidth={2.2} />
              </button>
            ) : null}
          </div>

          {picking ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-(--border-light) bg-white shadow-(--shadow-card)">
              <div className="flex items-center gap-2 border-b border-(--border-light) px-3 py-2.5">
                <Search
                  className="size-4 flex-none text-(--text-tertiary)"
                  strokeWidth={2}
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un sujet…"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
                />
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {options === null ? (
                  <p className="px-3.5 py-3 text-[13px] text-(--text-tertiary)">
                    Chargement…
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="px-3.5 py-3 text-[13px] text-(--text-tertiary)">
                    Aucun sujet trouvé.
                  </p>
                ) : (
                  filtered.slice(0, 50).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSubjectId(o.id);
                        setSubjectTitle(o.title);
                        setFolderSlug(o.folderSlug);
                        setPicking(false);
                      }}
                      className="flex w-full items-center gap-2 border-b border-(--border-light) px-3.5 py-2.5 text-left text-[13.5px] last:border-b-0"
                    >
                      <span
                        aria-hidden
                        className="size-2 flex-none rounded-full"
                        style={{ background: folderColor(o.folderSlug) }}
                      />
                      <span className="font-numeric text-[11px] font-semibold text-(--text-tertiary)">
                        {o.reference}
                      </span>
                      <span className="truncate font-semibold">{o.title}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Date + heure. */}
        <div className="flex min-w-0 gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5">
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
              className="w-[64px] bg-transparent text-[14px] outline-none"
            />
          </label>
          {/* Retirer la date — croix, comme le détachement du sujet. */}
          {date ? (
            <button
              type="button"
              onClick={() => {
                setDate("");
                setTime("");
              }}
              aria-label="Retirer la date"
              className="grid size-[42px] flex-none place-items-center rounded-xl border border-(--border) text-(--text-tertiary)"
            >
              <X className="size-[18px]" strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        {/* Créateur (édition seulement) — rappel discret. */}
        {mode === "edit" && initial.sourceActor ? (
          <div className="flex items-center gap-2 text-[12.5px] text-(--text-tertiary)">
            <ActorPill actor={initial.sourceActor} />
            Créée par {initial.sourceActor === "ai" ? "Relvo" : "vous"}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="flex-1 rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {mode === "create" ? "Créer" : "Enregistrer"}
          </button>
          {mode === "edit" ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Supprimer la tâche"
              className="grid size-[42px] flex-none place-items-center rounded-xl border border-(--red-200) text-(--red-600) disabled:opacity-60"
            >
              <Trash2 className="size-[18px]" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
