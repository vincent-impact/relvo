"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Sparkle, Trash } from "@/components/shared/picto";
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
  className,
}: {
  folderId: string;
  notes: Instruction[];
  className?: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className={cn("px-4 pt-4", className)}>
      {/* Une liste = UNE carte : les instructions en lignes, la ligne « Ajouter »
          en dernier (design-system/02-composants). */}
      <div className="overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
        {notes.length === 0 ? (
          <p className="px-4 py-5 text-[13.5px] font-light text-gris">
            Aucune instruction. Ajoutez des consignes que Relvo suivra.
          </p>
        ) : (
          notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setEditing(n)}
              className="flex w-full items-start gap-2.5 border-b border-(--filet) px-3.5 py-3 text-left active:bg-(--fond-enfonce)"
            >
              <Sparkle
                className={cn(
                  "mt-1 size-3.5 flex-none",
                  n.active ? "text-relvo" : "text-(--gris-clair)",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex-1 truncate text-[14.5px] leading-[18px] font-normal",
                      n.active ? "text-noir" : "text-gris",
                    )}
                  >
                    {n.name}
                  </span>
                  {!n.active ? (
                    <span className="flex-none rounded-(--rayon-pilule) bg-(--fond-puce) px-2 py-0.5 text-[10.5px] font-medium text-gris">
                      Désactivée
                    </span>
                  ) : null}
                </span>
                {n.content ? (
                  <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-[16px] font-light whitespace-pre-wrap text-gris">
                    {n.content}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[12.5px] font-light text-gris italic">
                    (Vide)
                  </span>
                )}
              </span>
            </button>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[14px] font-medium text-relvo active:bg-relvo-pale"
        >
          <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-pale">
            <Plus className="size-[15px]" strokeWidth={2.4} />
          </span>
          Ajouter une instruction
        </button>
      </div>

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
              <Trash className="size-[18px]" />
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
