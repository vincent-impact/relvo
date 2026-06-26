"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  createNoteAction,
  deleteNoteAction,
  setNoteActiveAction,
  updateNoteAction,
} from "@/server/actions/knowledge";
import { cn } from "@/lib/utils";

// Instructions d'un domaine (M9.20) — consignes que Relvo applique. Chaque
// instruction = un titre + un corps. La carte montre le titre + un aperçu
// (3 lignes) ; on l'ouvre pour la lire en entier, la modifier et l'activer /
// désactiver. V1 : seul l'utilisateur édite (invariant n°20).

export type Instruction = {
  id: string;
  name: string;
  content: string | null;
  active: boolean;
};

type Editing = Instruction | "new" | null;

export function InstructionList({
  folderId,
  notes,
}: {
  folderId: string;
  notes: Instruction[];
}) {
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className="px-4 pt-4">
      {notes.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-(--text-tertiary)">
          Aucune instruction. Ajoutez des consignes que Relvo suivra.
        </p>
      ) : (
        <div className="space-y-2.5">
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setEditing(n)}
              className="block w-full rounded-2xl border border-(--border-light) bg-white p-3.5 text-left shadow-(--shadow-card) transition active:scale-[0.99]"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Sparkles
                  className={cn(
                    "size-3.5 flex-none",
                    n.active ? "text-relvo" : "text-(--text-tertiary)",
                  )}
                  fill="currentColor"
                  strokeWidth={0}
                />
                <span className="flex-1 truncate text-[14.5px] font-bold">
                  {n.name}
                </span>
                {!n.active ? (
                  <span className="flex-none rounded-full bg-(--surface-2) px-2 py-0.5 text-[10.5px] font-bold text-(--text-tertiary)">
                    Désactivée
                  </span>
                ) : null}
              </div>
              {n.content ? (
                <p
                  className={cn(
                    "line-clamp-3 text-[13.5px] leading-[1.45] whitespace-pre-wrap",
                    n.active
                      ? "text-(--text-secondary)"
                      : "text-(--text-tertiary)",
                  )}
                >
                  {n.content}
                </p>
              ) : (
                <p className="text-[13px] text-(--text-tertiary) italic">
                  (Vide)
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-(--border) px-3.5 py-3.5 text-[13.5px] font-semibold text-(--text-secondary)"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-(--surface-2)">
          <Plus className="size-[15px]" strokeWidth={2.4} />
        </span>
        Ajouter une instruction
      </button>

      <InstructionEditor
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        folderId={folderId}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function InstructionEditor({
  folderId,
  editing,
  onClose,
}: {
  folderId: string;
  editing: Editing;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = editing === "new";
  const note = editing && editing !== "new" ? editing : null;

  // Champs locaux, ré-initialisés via key (cf. <InstructionEditor key=…>).
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
        onClose();
        router.refresh();
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
        onClose();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Nouvelle instruction" : "Instruction"}
          </DialogTitle>
        </DialogHeader>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Titre de l'instruction"
          className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-relvo"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Décrivez la consigne que Relvo doit suivre…"
          rows={8}
          className="max-h-[45vh] w-full resize-none rounded-xl border border-(--border) px-3 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-relvo"
        />

        {!isNew ? (
          <label className="flex items-center justify-between rounded-xl bg-(--surface) px-3.5 py-2.5">
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
            className="flex-1 rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {isNew ? "Créer" : "Enregistrer"}
          </button>
          {!isNew ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Supprimer l'instruction"
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
