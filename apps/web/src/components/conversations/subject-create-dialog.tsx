"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Dialog de CRÉATION d'un sujet (2026-07-23) — s'ouvre à « Ouvrir un sujet »
// depuis une conversation : l'utilisateur affecte un TITRE, un DESCRIPTIF (aide
// l'IA) et un DOMAINE avant que le sujet n'existe. Le descriptif atterrit dans
// `Subject.description`, le domaine dans `folderId`.

export type FolderOption = {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  icon: string | null;
};

export function SubjectCreateDialog({
  open,
  onOpenChange,
  defaultTitle,
  folders,
  pending = false,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titre pré-rempli (objet de l'email, nom de l'interlocuteur…). */
  defaultTitle: string;
  folders: FolderOption[];
  pending?: boolean;
  onCreate: (input: {
    title: string;
    description: string | null;
    folderId: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);

  // À chaque ouverture, on repart du titre proposé (et on vide le reste).
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setFolderId(null);
    }
  }, [open, defaultTitle]);

  const canCreate = title.trim().length > 0 && !pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Nouveau sujet</DialogTitle>
        </DialogHeader>

        {/* Titre */}
        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            Titre
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Intitulé du sujet"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
          />
        </div>

        {/* Descriptif */}
        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            Descriptif{" "}
            <span className="font-normal text-(--text-tertiary)">
              (aide Relvo)
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="En quelques mots, de quoi s'agit-il ?"
            className="w-full resize-y rounded-xl border border-(--border) px-3 py-2.5 text-[14px] leading-[1.5] outline-none placeholder:text-(--text-tertiary) focus:border-brand"
          />
        </div>

        {/* Domaine */}
        {folders.length > 0 ? (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-bold text-(--text-secondary)">
              Domaine
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFolderId(null)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
                  folderId == null
                    ? "border-transparent bg-(--text-primary) text-white"
                    : "border-(--border) bg-white text-(--text-secondary)",
                )}
              >
                Aucun
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
                    onClick={() => setFolderId(active ? null : f.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
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
                      className="size-[14px] flex-none"
                      strokeWidth={2.2}
                      style={active ? undefined : { color: viz.color }}
                    />
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canCreate}
          onClick={() =>
            onCreate({
              title: title.trim(),
              description: description.trim() || null,
              folderId,
            })
          }
          className="mt-1 w-full rounded-full bg-brand py-3 text-[14.5px] font-bold text-white active:opacity-90 disabled:opacity-50"
        >
          Créer le sujet
        </button>
      </DialogContent>
    </Dialog>
  );
}
