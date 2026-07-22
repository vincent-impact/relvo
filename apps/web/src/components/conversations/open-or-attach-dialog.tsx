"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SubjectPickerOption } from "@/components/messages/subject-picker-dialog";
import { folderVisual } from "@/lib/folders";

// Swipe droite sur un fil EMAIL (M6ter, invariant n°13bis) — deux issues : ouvrir
// un NOUVEAU sujet (le sujet EST le fil) OU rattacher le fil à un sujet EXISTANT.
// Un seul dialog les présente : l'action neuve en tête (prépondérante), la liste
// des sujets existants dessous (recherche, car un client en a beaucoup).

export function OpenOrAttachDialog({
  open,
  onOpenChange,
  subjects,
  onNew,
  onAttach,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: SubjectPickerOption[];
  onNew: () => void;
  onAttach: (subjectId: string) => void;
  pending?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = (
    q
      ? subjects.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.reference.toLowerCase().includes(q),
        )
      : subjects
  ).slice(0, 60);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Ce fil d'email</DialogTitle>
        </DialogHeader>

        <button
          type="button"
          disabled={pending}
          onClick={onNew}
          className="flex w-full items-center gap-3 rounded-xl border border-brand bg-(--blue-50) px-3.5 py-3 text-left disabled:opacity-60"
        >
          <Sparkles
            className="size-[18px] flex-none text-brand"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold text-(--text-primary)">
              Ouvrir un nouveau sujet
            </span>
            <span className="block text-[12.5px] text-(--text-tertiary)">
              Tout le fil devient ce sujet.
            </span>
          </span>
        </button>

        {subjects.length > 0 ? (
          <>
            <p className="text-[12px] font-semibold text-(--text-tertiary)">
              ou rattacher à un sujet existant
            </p>

            <div className="flex items-center gap-2 rounded-xl border border-(--border-light) px-3.5 py-2.5">
              <Search
                className="size-[16px] flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un sujet…"
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
              />
            </div>

            <div className="-mx-1 max-h-[38vh] overflow-y-auto px-1">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-(--text-tertiary)">
                  Aucun sujet trouvé.
                </p>
              ) : (
                <div className="flex flex-col">
                  {filtered.map((s) => {
                    const { color, icon: Icon } = folderVisual(s.folderSlug);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={pending}
                        onClick={() => onAttach(s.id)}
                        className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-(--surface-2) disabled:opacity-60"
                      >
                        <span
                          className="grid size-9 flex-none place-items-center rounded-lg text-white"
                          style={{ background: color }}
                        >
                          <Icon className="size-[18px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold">
                            {s.title}
                          </span>
                          <span className="font-numeric text-[11.5px] text-(--text-tertiary)">
                            {s.reference}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
