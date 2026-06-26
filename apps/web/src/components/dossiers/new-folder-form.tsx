"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderLogoPicker } from "@/components/dossiers/folder-logo-picker";
import { FOLDER_COLORS, FOLDER_ICONS } from "@/lib/folders";
import { createFolderAction } from "@/server/actions/folders";

// Création d'un domaine de la Mémoire (M9.20) — nom + logo (couleur + icône).
// À la création, on ouvre la fiche du nouveau domaine.

export function NewFolderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]!.key);
  const [icon, setIcon] = useState(FOLDER_ICONS[0]!.key);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom du domaine est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createFolderAction({ name: trimmed, color, icon });
      if (res.ok) {
        toast.success("Domaine créé");
        router.replace(`/dossiers/${res.data.id}`);
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
        <span className="mb-1.5 block text-[12.5px] font-semibold text-(--text-secondary)">
          Nom du domaine
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Ex. Marketing, Maintenance…"
          className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-7 w-full rounded-xl bg-relvo py-3 text-[15px] font-bold text-white disabled:opacity-60"
      >
        Créer le domaine
      </button>
    </div>
  );
}
