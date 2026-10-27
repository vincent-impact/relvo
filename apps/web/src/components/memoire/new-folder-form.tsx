"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderLogoPicker } from "@/components/memoire/folder-logo-picker";
import { FOLDER_COLORS, FOLDER_ICONS } from "@/lib/folders";
import { createFolderAction } from "@/server/actions/folders";

// Création d'un domaine de la Mémoire (M9.20) — nom + logo (couleur + icône),
// dans le père reçu (M23.3 ; nul → sous Général). À la création, on ouvre la
// fiche du nouveau domaine.

export function NewFolderForm({ parentId }: { parentId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]!.key);
  const [icon, setIcon] = useState(FOLDER_ICONS[0]!.key);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom du dossier est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createFolderAction({
        name: trimmed,
        description: description.trim() || null,
        color,
        icon,
        parentId,
      });
      if (res.ok) {
        toast.success("Dossier créé");
        router.replace(`/memoire/${res.data.id}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="px-4 pt-5">
      <FolderLogoPicker
        name={name}
        color={color}
        icon={icon}
        onColor={setColor}
        onIcon={setIcon}
      />

      <label className="mt-5 block">
        <span className="libelle mb-1.5 block">Nom du dossier</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Ex. Marketing, Maintenance…"
          className="w-full rounded-(--rayon-option) border border-(--filet) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
        />
      </label>

      {/* La description aide Relvo à ranger (M27.3) : demandée à la création,
          facultative — l'invite en pointillé de la fiche la rappelle. */}
      <label className="mt-4 block">
        <span className="libelle mb-1.5 block">
          En une phrase, ce qu’on y range
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex. Nos achats de produits frais et secs, hors boissons et emballages."
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-(--rayon-option) border border-(--filet) px-3 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-relvo"
        />
        <span className="mt-1 block text-[12px] leading-4 font-normal text-gris">
          Relvo lit cette phrase pour décider si un sujet se range ici.
        </span>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-7 w-full rounded-(--rayon-pilule) bg-relvo py-3 text-[15px] font-medium text-white disabled:opacity-60"
      >
        Créer le dossier
      </button>
    </div>
  );
}
