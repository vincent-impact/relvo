"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  createNoteAction,
  deleteNoteAction,
  setNoteActiveAction,
  updateNoteAction,
} from "@/server/actions/knowledge";

// Éditeur d'instruction PLEINE PAGE (M9.20) — création ou édition, dans un
// espace dédié (route /dossiers/[id]/instructions/[noteId|nouveau]). Titre +
// corps, et en édition : interrupteur d'activation + suppression.

type Note = {
  id: string;
  name: string;
  content: string | null;
  active: boolean;
};

export function NoteForm({
  folderId,
  note,
}: {
  folderId: string;
  /** Absent = création. */
  note?: Note;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = !note;
  const [name, setName] = useState(note?.name ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [active, setActive] = useState(note?.active ?? true);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le titre est requis.");
      return;
    }
    startTransition(async () => {
      const res = isNew
        ? await createNoteAction({
            folderId,
            name: trimmed,
            content: content.trim() || null,
          })
        : await updateNoteAction(note!.id, {
            name: trimmed,
            content: content.trim() || null,
          });
      if (res.ok) {
        toast.success(isNew ? "Instruction créée" : "Instruction enregistrée");
        if (isNew) {
          router.replace(`/dossiers/${folderId}/instructions/${res.data.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.message);
      }
    });
  }

  function toggleActive(next: boolean) {
    if (!note) return;
    setActive(next);
    startTransition(async () => {
      const res = await setNoteActiveAction(note.id, next);
      if (res.ok) router.refresh();
      else {
        setActive(!next);
        toast.error(res.message);
      }
    });
  }

  function remove() {
    if (!note) return;
    startTransition(async () => {
      const res = await deleteNoteAction(note.id);
      if (res.ok) {
        toast.success("Instruction supprimée");
        router.replace(`/dossiers/${folderId}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus={isNew}
        placeholder="Titre de l'instruction"
        className="w-full rounded-xl border border-(--border) px-3.5 py-3 text-[16px] font-semibold outline-none focus:border-relvo"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Décrivez la consigne que Relvo doit suivre, en langage naturel…"
        className="min-h-[40vh] w-full resize-y rounded-xl border border-(--border) px-3.5 py-3 text-[14.5px] leading-[1.55] outline-none focus:border-relvo"
      />

      {!isNew ? (
        <label className="flex items-center justify-between rounded-xl bg-(--surface) px-3.5 py-3">
          <span className="text-[13.5px] font-semibold text-(--text-secondary)">
            {active ? "Activée — Relvo l'applique" : "Désactivée"}
          </span>
          <Switch
            checked={active}
            onCheckedChange={(v) => toggleActive(Boolean(v))}
            disabled={pending}
          />
        </label>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex-1 rounded-xl bg-relvo py-3 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {isNew ? "Créer l'instruction" : "Enregistrer"}
        </button>
        {!isNew ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Supprimer l'instruction"
            className="grid size-[46px] flex-none place-items-center rounded-xl border border-(--red-200) text-(--red-600) disabled:opacity-60"
          >
            <Trash2 className="size-[18px]" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
