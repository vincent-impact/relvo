"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { CalendarDots, Clock, Trash } from "@/components/shared/picto";
import { toast } from "sonner";
import type { Actor } from "@relvo/db";
import { ActorPill } from "@/components/shared/actor-pill";
import type { RelvoTaskInfo } from "@/lib/task-item-data";
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
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Feuille d'une tâche — PARTAGÉE entre la ligne (TaskItem) et la création
// (bouton + de l'Accueil). Un tap sur une ligne OUVRE LA TÂCHE POUR LA LIRE
// (recette de l'alpha, R16) : le titre, son sujet, sa date, pourquoi Relvo la
// propose et d'après quoi (M7.20), et le MESSAGE d'où elle vient — « Voir le
// message » ouvre le fil sur lui, surligné, parce que le résumé de Relvo ne
// suffit pas toujours à retrouver le contexte. « Modifier » (ou un tap sur un
// champ) passe au formulaire : titre, date/heure, sujet rattaché (affiché,
// (ré)assignable, ou détaché — une tâche peut ne pas avoir de sujet). Le
// créateur (Relvo/Moi) est rappelé ici, retiré des lignes pour ne pas les
// surcharger.

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
    /** Raison et provenance d'une tâche de Relvo, en clair (M7.20). */
    relvo?: RelvoTaskInfo | null;
    /** Le message d'où la tâche vient, et son fil (R16) — « Voir le message ». */
    sourceMessageId?: string | null;
    sourceConversationId?: string | null;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Une tâche existante s'ouvre en LECTURE ; le formulaire vient après.
  const [editing, setEditing] = useState(mode === "create");

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

  const messageHref = initial.sourceConversationId
    ? `/conversations/${initial.sourceConversationId}?${new URLSearchParams({
        ...(initial.sourceMessageId
          ? { message: initial.sourceMessageId }
          : {}),
        from: pathname,
      }).toString()}`
    : null;

  // Ce que Relvo dit de la tâche, et d'où elle vient — dans les deux états.
  const relvoBlock =
    mode === "edit" && initial.sourceActor ? (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[12.5px] text-(--text-tertiary)">
          <ActorPill actor={initial.sourceActor} />
          Créée par {initial.sourceActor === "ai" ? "Relvo" : "vous"}
        </div>
        {initial.sourceActor === "ai" && initial.relvo ? (
          <div className="rounded-xl border border-(--purple-100) bg-relvo-bg px-3 py-2.5 text-[13px] leading-[1.45]">
            {initial.relvo.raison ? (
              <p className="text-brand-dark">{initial.relvo.raison}</p>
            ) : null}
            {initial.relvo.provenance ? (
              <p
                className={cn(
                  "text-[12.5px] text-relvo",
                  initial.relvo.raison && "mt-1",
                )}
              >
                {initial.relvo.provenance}
              </p>
            ) : null}
          </div>
        ) : null}
        {messageHref ? (
          <Link
            href={messageHref}
            className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5 text-[14px] font-medium text-relvo active:bg-(--fond-puce)"
          >
            <span className="min-w-0 flex-1">Voir le message d’origine</span>
            <ChevronRight
              className="size-[18px] flex-none text-(--gris-clair)"
              strokeWidth={2.2}
            />
          </Link>
        ) : null}
      </div>
    ) : null;

  if (!editing) {
    // LECTURE — chaque champ se tape pour passer au formulaire.
    const quand = initial.date
      ? `${new Date(`${initial.date}T00:00:00.000Z`).toLocaleDateString(
          "fr-FR",
          { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
        )}${initial.time ? ` · ${initial.time}` : ""}`
      : null;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Tâche</DialogTitle>
          </DialogHeader>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left text-[17px] leading-[22px] font-medium text-noir"
          >
            {initial.title}
          </button>

          <div className="overflow-hidden rounded-xl border border-(--border)">
            <div className="flex items-center gap-2 border-b border-(--border-light) px-3 py-2.5">
              {initial.subjectId ? (
                <span
                  aria-hidden
                  className="size-2.5 flex-none rounded-full"
                  style={{
                    background: folderVisual({
                      slug: initial.subjectFolderSlug ?? null,
                    }).color,
                  }}
                />
              ) : null}
              {initial.subjectId && initial.subjectTitle ? (
                <Link
                  href={`/sujets/${initial.subjectId}?from=${encodeURIComponent(pathname)}`}
                  className="min-w-0 flex-1 truncate text-[14px] font-semibold"
                >
                  {initial.subjectTitle}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="min-w-0 flex-1 text-left text-[14px] text-(--text-tertiary) italic"
                >
                  Aucun sujet
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <CalendarDots className="size-4 flex-none text-(--text-tertiary)" />
              <span
                className={cn(
                  "min-w-0 flex-1 text-[14px]",
                  quand ? "chiffre text-noir" : "text-(--text-tertiary) italic",
                )}
              >
                {quand ?? "Sans date"}
              </span>
            </button>
          </div>

          {relvoBlock}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Supprimer la tâche"
              className="grid size-[42px] flex-none place-items-center rounded-xl border border-(--red-200) text-(--red-600) disabled:opacity-60"
            >
              <Trash className="size-[18px]" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
                  style={{
                    background: folderVisual({ slug: folderSlug }).color,
                  }}
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
                        style={{
                          background: folderVisual({ slug: o.folderSlug })
                            .color,
                        }}
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
            <CalendarDots className="size-4 flex-none text-(--text-tertiary)" />
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
            <Clock className="size-4 flex-none text-(--text-tertiary)" />
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

        {relvoBlock}

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
              <Trash className="size-[18px]" />
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
