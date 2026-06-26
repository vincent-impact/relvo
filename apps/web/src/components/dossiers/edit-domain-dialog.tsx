"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { FolderLogoPicker } from "@/components/dossiers/folder-logo-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_COLORS, FOLDER_ICONS } from "@/lib/folders";
import { updateFolderAction } from "@/server/actions/folders";

// Édition d'un domaine existant (M9.20) — nom + logo (couleur + icône). Bouton
// crayon dans le hero de la fiche domaine → Dialog avec le même sélecteur que la
// création. Les domaines du seed (sans logo stocké) partent sur un choix par
// défaut, matérialisé dès l'enregistrement.

export function EditDomainButton({
  id,
  name: initialName,
  color: initialColor,
  icon: initialIcon,
}: {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? FOLDER_COLORS[0]!.key);
  const [icon, setIcon] = useState(initialIcon ?? FOLDER_ICONS[0]!.key);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom du domaine est requis.");
      return;
    }
    startTransition(async () => {
      const res = await updateFolderAction(id, { name: trimmed, color, icon });
      if (res.ok) {
        toast.success("Domaine mis à jour");
        setOpen(false);
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
        aria-label="Modifier le domaine"
        className="grid size-[38px] flex-none place-items-center rounded-full text-white active:scale-95"
        style={{ background: "rgb(255 255 255 / 0.16)" }}
      >
        <Pencil className="size-[17px]" strokeWidth={2} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Modifier le domaine</DialogTitle>
          </DialogHeader>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-(--text-secondary)">
              Nom du domaine
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
            />
          </label>

          <FolderLogoPicker
            name={name}
            color={color}
            icon={icon}
            onColor={setColor}
            onIcon={setIcon}
          />

          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
