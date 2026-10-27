"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { PencilSimple } from "@/components/shared/picto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateFolderAction } from "@/server/actions/folders";
import { cn } from "@/lib/utils";

// La DESCRIPTION d'un dossier (M27.3) — la première carte de sa fiche, sous le
// ciel. C'est elle qui aide Relvo à ranger : la couche Compte des consignes
// liste les dossiers avec leur description (05 §10.1), et le classement d'un
// message choisit le chemin dont la description convient. Signée d'un rappel
// (« Relvo s'en sert pour ranger les sujets ici ») et du crayon. Quand elle
// manque, la carte est une INVITE en pointillé — le pointillé dit « à
// compléter » (design-system/01-tokens) — et non un vide.

export function FolderDescription({
  folderId,
  description,
  className,
}: {
  folderId: string;
  description: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState(description ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = texte.trim();
    startTransition(async () => {
      const res = await updateFolderAction(folderId, {
        description: trimmed || null,
      });
      if (res.ok) {
        toast.success(
          trimmed ? "Description enregistrée" : "Description retirée",
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const vide = !description?.trim();

  return (
    <>
      {vide ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "mx-4 block w-[calc(100%-32px)] rounded-(--rayon-carte) border-2 border-dashed border-(--gris-clair) bg-white px-3.5 py-3 text-left active:bg-(--fond-enfonce)",
            className,
          )}
        >
          <p className="text-[14px] leading-5 font-normal text-gris">
            Décrivez ce dossier en une phrase : Relvo s’en servira pour y ranger
            les bons sujets.
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-relvo">
            <Plus className="size-[15px]" strokeWidth={2.4} />
            Décrire ce dossier
          </span>
        </button>
      ) : (
        <div
          className={cn(
            "mx-4 rounded-(--rayon-carte) border border-(--filet) bg-white px-3.5 pt-3 pb-2.5 shadow-carte",
            className,
          )}
        >
          <p className="text-[14.5px] leading-5 font-light text-noir">
            {description}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] leading-4 font-normal text-gris">
              <RelvoLogo size={11} variant="full" title="" />
              <span className="truncate">
                Relvo s’en sert pour ranger les sujets ici
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Modifier la description"
              className="relative grid size-7 flex-none place-items-center rounded-full bg-(--fond-puce) text-gris before:absolute before:-inset-2 before:content-[''] active:bg-(--relvo-filet)"
            >
              <PencilSimple className="size-[15px]" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Ce dossier, en une phrase</DialogTitle>
          </DialogHeader>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            autoFocus
            placeholder="Ex. Nos achats de produits frais et secs, hors boissons et emballages."
            rows={4}
            maxLength={500}
            className="max-h-[40vh] w-full resize-none rounded-(--rayon-option) border border-(--filet) px-3 py-2.5 text-[14px] leading-[1.5] outline-none focus:border-relvo"
          />
          <p className="text-[12px] leading-4 font-normal text-gris">
            Relvo lit cette phrase pour décider si un sujet se range ici plutôt
            qu’ailleurs.
          </p>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-(--rayon-pilule) bg-relvo py-2.5 text-[14px] font-medium text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
