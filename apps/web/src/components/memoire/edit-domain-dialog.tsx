"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@/components/shared/picto";
import { SKY_BTN } from "@/components/layout/relvo-header";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FolderLogoPicker } from "@/components/memoire/folder-logo-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_COLORS, FOLDER_ICONS } from "@/lib/folders";
import { cn } from "@/lib/utils";
import {
  deleteFolderAction,
  moveFolderAction,
  updateFolderAction,
} from "@/server/actions/folders";

// Édition d'un domaine existant (M9.20, M23.3) — nom + logo (couleur +
// icône), le père dans lequel il est rangé, et sa suppression. Bouton crayon
// dans le hero de la fiche domaine → Dialog avec le même sélecteur que la
// création. Les domaines du seed (sans logo stocké) partent sur un choix par
// défaut, matérialisé dès l'enregistrement.
//
// « Ranger dans » ne propose que ce que l'arbre accepte : ni lui-même ni un
// de ses fils, et jamais une profondeur qui dépasserait la borne. Supprimer
// remonte ce qu'il contient chez le père — la confirmation le dit.

/** Un père possible : son chemin lisible ; `null` = sous Général. */
export type MoveTarget = { id: string | null; label: string };

export function EditDomainButton({
  id,
  name: initialName,
  color: initialColor,
  icon: initialIcon,
  parentId: initialParentId,
  parentLabel,
  targets,
  afterDelete,
  rootDelete,
}: {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  /** Le père actuel ; null = sous Général. */
  parentId: string | null;
  /** Le nom du père, pour dire où remonte le contenu à la suppression. */
  parentLabel: string;
  /** Les pères possibles, Général compris (`id: null`). */
  targets: MoveTarget[];
  /** Où aller une fois le domaine supprimé : la fiche du père, ou la Mémoire. */
  afterDelete: string;
  /** Le père est Général : les affaires redeviennent « sans domaine ». */
  rootDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? FOLDER_COLORS[0]!.key);
  const [icon, setIcon] = useState(initialIcon ?? FOLDER_ICONS[0]!.key);
  const [parentId, setParentId] = useState<string | null>(initialParentId);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom du domaine est requis.");
      return;
    }
    startTransition(async () => {
      const res = await updateFolderAction(id, { name: trimmed, color, icon });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (parentId !== initialParentId) {
        const moved = await moveFolderAction(id, parentId);
        if (!moved.ok) {
          toast.error(moved.message);
          return;
        }
      }
      toast.success("Domaine mis à jour");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteFolderAction(id);
      if (res.ok) {
        toast.success(`« ${initialName} » supprimé.`);
        setConfirm(false);
        setOpen(false);
        router.replace(afterDelete);
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
        className={SKY_BTN}
      >
        <PencilSimple className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto p-5">
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

          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-(--text-secondary)">
              Rangé dans
            </span>
            <div className="flex flex-wrap gap-2">
              {targets.map((t) => {
                const active = t.id === parentId;
                return (
                  <button
                    key={t.id ?? "general"}
                    type="button"
                    onClick={() => setParentId(t.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-9 max-w-full items-center rounded-(--rayon-pilule) border px-3.5 text-[13px] font-medium transition-colors",
                      active
                        ? "border-noir bg-noir text-white"
                        : "border-(--filet) bg-white text-noir",
                    )}
                  >
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>

          {/* La suppression en pied, en lien : jamais un bouton rouge à côté
              d'« Enregistrer ». Elle confirme en nommant ce qui remonte. */}
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={pending}
            className="mx-auto inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-(--red-600) disabled:opacity-60"
          >
            <Trash className="size-4" />
            Supprimer ce domaine
          </button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer « ${initialName} » ?`}
        description={
          rootDelete
            ? `Ses sous-domaines, instructions et documents remontent dans ${parentLabel}. Ses affaires restent, sans domaine. Rien n’est perdu.`
            : `Ses sous-domaines, instructions, documents et affaires remontent dans « ${parentLabel} ». Rien n’est perdu.`
        }
        confirmLabel="Supprimer"
        tone="destructive"
        icon={Trash}
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}
