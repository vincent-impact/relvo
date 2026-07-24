"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Actor, Priority } from "@relvo/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  setSubjectPriorityAction,
  updateSubjectAction,
} from "@/server/actions/subjects";
import { folderVisual } from "@/lib/folders";
import { formatRelative } from "@/lib/display";
import { cn } from "@/lib/utils";

// Onglet « Informations » de la fiche Sujet (2026-07-24). L'onglet « Détail » a
// été supprimé : son contenu utile a migré ici. Ordre FIXE :
//   1. Descriptif (éditable, aide Relvo)
//   2. Domaine (tap → sélecteur) + Urgence (interrupteur), sur la même ligne
//   3. Rapport d'activité Relvo (placeholder honnête)
//   4. Journal (tiroir)
// La suppression du sujet reste accessible en bas.

export type PaneFolder = {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  icon: string | null;
};
export type PaneEvent = {
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

export function InformationsPane({
  subjectId,
  description,
  folders,
  folderId,
  priority,
  events,
}: {
  subjectId: string;
  description: string | null;
  folders: PaneFolder[];
  folderId: string | null;
  priority: Priority;
  events: PaneEvent[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(description ?? "");
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const base = (description ?? "").trim();
  const folder = folders.find((f) => f.id === folderId) ?? null;
  const folderViz = folderVisual(
    folder
      ? { slug: folder.slug, color: folder.color, icon: folder.icon }
      : "general",
  );
  const FolderIcon = folderViz.icon;

  function saveDescription() {
    const next = value.trim();
    if (next === base) return;
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, {
        description: next || null,
      });
      if (res.ok) {
        toast.success("Descriptif enregistré");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function setFolder(nextId: string | null) {
    setPickerOpen(false);
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, { folderId: nextId });
      if (res.ok) {
        toast.success("Domaine mis à jour");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function toggleUrgent(next: boolean) {
    startTransition(async () => {
      const res = await setSubjectPriorityAction(
        subjectId,
        next ? "urgent" : "normal",
      );
      if (res.ok) router.refresh();
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-2">
      {/* 1. Descriptif éditable */}
      <section>
        <h2 className="text-[15px] font-bold text-(--text-primary)">
          Descriptif
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-[1.4] text-(--text-tertiary)">
          Aidez Relvo à rattacher le bon domaine et à chercher dans les bonnes
          conversations.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={saveDescription}
          rows={4}
          placeholder="Décrivez ce sujet en quelques mots…"
          className="mt-2.5 w-full resize-y rounded-xl border border-(--border) bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-(--text-primary) outline-none placeholder:text-(--text-tertiary) focus:border-brand"
        />
      </section>

      {/* 2. Domaine (tap → sélecteur) + Urgence (interrupteur), inline */}
      <section className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) bg-white px-3 py-2.5 text-left active:bg-(--surface-2)"
        >
          <span
            className="grid size-7 flex-none place-items-center rounded-lg text-white"
            style={{ background: folderViz.color }}
          >
            <FolderIcon className="size-[15px]" strokeWidth={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-bold tracking-[0.3px] text-(--text-tertiary) uppercase">
              Domaine
            </span>
            <span className="block truncate text-[14px] font-semibold text-(--text-primary)">
              {folder?.name ?? "Non classé"}
            </span>
          </span>
          <ChevronDown
            className="size-4 flex-none text-(--text-tertiary)"
            strokeWidth={2.2}
          />
        </button>

        <label className="flex flex-none flex-col items-center gap-1.5">
          <span
            className={cn(
              "text-[10.5px] font-bold tracking-[0.3px] uppercase",
              priority === "urgent"
                ? "text-(--red-600)"
                : "text-(--text-tertiary)",
            )}
          >
            Urgent
          </span>
          <Switch
            checked={priority === "urgent"}
            onCheckedChange={toggleUrgent}
            disabled={pending}
            className="data-checked:bg-(--red-600)"
          />
        </label>
      </section>

      {/* 3. Rapport d'activité de Relvo — placeholder */}
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-relvo">
          <Sparkles className="size-4" fill="currentColor" strokeWidth={0} />
          Rapport d'activité de Relvo
        </div>
        <div className="rounded-xl border border-(--border) bg-(--surface-2) px-3.5 py-4 text-center text-[13.5px] font-semibold text-(--text-tertiary)">
          Indisponible
        </div>
      </section>

      {/* 4. Journal (tiroir) */}
      <details className="group overflow-hidden rounded-2xl border border-(--border-light) bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5">
            <History
              className="size-[18px] flex-none text-(--text-tertiary)"
              strokeWidth={2}
            />
            <span className="text-[15px] font-bold">Journal</span>
            <span className="text-[13px] font-semibold text-(--text-tertiary)">
              {events.length}
            </span>
          </span>
          <ChevronDown
            className="size-5 flex-none text-(--text-tertiary) transition-transform group-open:rotate-180"
            strokeWidth={2.2}
          />
        </summary>
        <div className="px-4 pb-3">
          {events.length === 0 ? (
            <p className="pb-1 text-[13.5px] text-(--text-tertiary)">
              Journal vide.
            </p>
          ) : (
            <div className="pt-1 pb-1">
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
      </details>

      {/* Sélecteur de domaine */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Domaine du sujet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFolder(null)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                folderId == null
                  ? "border-transparent bg-(--text-primary) text-white"
                  : "border-(--border) bg-white text-(--text-secondary)",
              )}
            >
              Non classé
            </button>
            {folders.map((f) => {
              const viz = folderVisual({
                slug: f.slug,
                color: f.color,
                icon: f.icon,
              });
              const active = folderId === f.id;
              const Icon = viz.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                    active
                      ? "border-transparent text-white"
                      : "border-(--border) bg-white text-(--text-secondary)",
                  )}
                  style={
                    active
                      ? { background: viz.color, borderColor: viz.color }
                      : undefined
                  }
                >
                  <Icon
                    className="size-[15px] flex-none"
                    strokeWidth={2.2}
                    style={active ? undefined : { color: viz.color }}
                  />
                  {f.name}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
