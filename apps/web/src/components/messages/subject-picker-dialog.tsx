"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { folderVisual } from "@/lib/folders";

// Sélecteur de sujet (Direction B) — rattacher un message « Sans sujet » à un
// sujet EXISTANT (Relvo s'est trompé / a oublié). Champ de recherche (les clients
// ont beaucoup de sujets) + liste avec l'icône de domaine. Modale shadcn (Dialog).

export type SubjectPickerOption = {
  id: string;
  reference: string;
  title: string;
  folderSlug: string | null;
};

export function SubjectPickerDialog({
  open,
  onOpenChange,
  subjects,
  onSelect,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: SubjectPickerOption[];
  onSelect: (subjectId: string) => void;
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
          <DialogTitle>Rattacher à un sujet</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-(--border-light) px-3.5 py-2.5">
          <Search
            className="size-[16px] flex-none text-(--text-tertiary)"
            strokeWidth={2}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un sujet…"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
          />
        </div>

        <div className="-mx-1 max-h-[46vh] overflow-y-auto px-1">
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
                    onClick={() => onSelect(s.id)}
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
      </DialogContent>
    </Dialog>
  );
}
