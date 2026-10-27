"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder, PencilSimple, Trash } from "@/components/shared/picto";
import { ChevronRight } from "lucide-react";
import {
  RangerDansSheet,
  type DossierChoix,
} from "@/components/memoire/ranger-dans-sheet";
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
  arbre,
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
  /** Les pères possibles, Général compris (`id: null`) : les autres sont grisés dans la feuille. */
  targets: MoveTarget[];
  /** L'arbre entier, pour la feuille « Rangé dans… » (M27.4). */
  arbre: DossierChoix[];
  /** Où aller une fois le domaine supprimé : la fiche du père, ou la Mémoire. */
  afterDelete: string;
  /** Le père est Général : les sujets redeviennent « sans domaine ». */
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
  const [choixPere, setChoixPere] = useState(false);
  const possibles = new Set(
    targets.map((t) => t.id).filter((t): t is string => t != null),
  );
  const exclus = new Set(
    arbre.map((d) => d.id).filter((id) => !possibles.has(id)),
  );
  const pereLabel =
    parentId == null
      ? "Général (à la racine)"
      : (arbre.find((d) => d.id === parentId)?.path ?? "…");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom du dossier est requis.");
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
      toast.success("Dossier mis à jour");
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
        aria-label="Modifier le dossier"
        className={SKY_BTN}
      >
        <PencilSimple className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle>Modifier le dossier</DialogTitle>
          </DialogHeader>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-(--text-secondary)">
              Nom du dossier
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

          {/* « Rangé dans » ouvre la même feuille que le rangement d'un sujet :
              le même arbre, Général choisissable (à la racine), ce que l'arbre
              refuse grisé — lui-même, ses fils, trop profond. */}
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-(--text-secondary)">
              Rangé dans
            </span>
            <button
              type="button"
              onClick={() => setChoixPere(true)}
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-(--border) px-3 text-left text-[14px] text-noir"
            >
              <Folder className="size-[18px] flex-none text-gris" />
              <span className="min-w-0 flex-1 truncate">{pereLabel}</span>
              <ChevronRight
                className="size-4 flex-none text-(--gris-clair)"
                strokeWidth={2}
              />
            </button>
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
            Supprimer ce dossier
          </button>
        </DialogContent>
      </Dialog>

      <RangerDansSheet
        open={choixPere}
        onOpenChange={setChoixPere}
        titre="Rangé dans…"
        sousTitre={`Le dossier « ${initialName} » et tout ce qu’il contient`}
        dossiers={arbre}
        actuel={parentId}
        racine="choisissable"
        exclus={exclus}
        onChoix={setParentId}
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer « ${initialName} » ?`}
        description={
          rootDelete
            ? `Ses dossiers, instructions et documents remontent dans ${parentLabel}. Ses sujets restent, sans dossier. Rien n’est perdu.`
            : `Ses dossiers, instructions, documents et sujets remontent dans « ${parentLabel} ». Rien n’est perdu.`
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
