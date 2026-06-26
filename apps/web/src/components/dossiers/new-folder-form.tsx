"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FOLDER_COLORS, FOLDER_ICONS, folderVisual } from "@/lib/folders";
import { createFolderAction } from "@/server/actions/folders";
import { cn } from "@/lib/utils";

// Création d'un domaine de la Mémoire (M9.20) — nom + logo (couleur de palette
// + icône curée), avec aperçu en direct. À la création, on ouvre la fiche du
// nouveau domaine.

export function NewFolderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]!.key);
  const [icon, setIcon] = useState(FOLDER_ICONS[0]!.key);

  const visual = folderVisual({ color, icon });
  const PreviewIcon = visual.icon;

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
      {/* Aperçu du logo */}
      <div className="mb-5 flex items-center gap-3.5">
        <span
          className="grid size-16 flex-none place-items-center rounded-2xl text-white"
          style={{ background: visual.color }}
        >
          <PreviewIcon className="size-7" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-bold">
            {name.trim() || "Nouveau domaine"}
          </div>
          <div className="text-[13px] text-(--text-tertiary)">
            Un domaine de la mémoire de Relvo
          </div>
        </div>
      </div>

      <label className="block">
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

      <div className="mt-5">
        <span className="mb-2 block text-[12.5px] font-semibold text-(--text-secondary)">
          Couleur
        </span>
        <div className="flex flex-wrap gap-2.5">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.key}
              aria-pressed={color === c.key}
              onClick={() => setColor(c.key)}
              className={cn(
                "size-9 rounded-full ring-offset-2 transition",
                color === c.key && "ring-2 ring-(--text-primary)",
              )}
              style={{ background: c.value }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-2 block text-[12.5px] font-semibold text-(--text-secondary)">
          Icône
        </span>
        <div className="grid grid-cols-6 gap-2.5">
          {FOLDER_ICONS.map((i) => {
            const Icon = i.icon;
            const active = icon === i.key;
            return (
              <button
                key={i.key}
                type="button"
                aria-label={i.key}
                aria-pressed={active}
                onClick={() => setIcon(i.key)}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border transition",
                  active
                    ? "border-relvo bg-relvo-bg text-relvo"
                    : "border-(--border-light) text-(--text-secondary)",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </div>

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
