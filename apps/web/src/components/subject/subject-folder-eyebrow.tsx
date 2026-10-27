"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  RangerDansSheet,
  type DossierChoix,
} from "@/components/memoire/ranger-dans-sheet";
import { folderVisual } from "@/lib/folders";
import { updateSubjectAction } from "@/server/actions/subjects";

// La ligne du dessus de la fiche d'un sujet : la bande et le chemin de son
// dossier, dans le ciel, comme sur sa ligne — et c'est AUSSI le geste qui le
// change (M27.4) : un tap ouvre la feuille « Ranger dans… », la même que
// partout, avec l'arbre entier. Le dossier n'est dit qu'une fois sur la fiche
// (02-composants, « un même chiffre n'est jamais rendu deux fois » vaut pour
// un mot) : la puce qui le répétait sous les onglets a disparu, son sélecteur
// est monté ici.

export type EyebrowFolder = DossierChoix;

export function SubjectFolderEyebrow({
  subjectId,
  folders,
  folderId,
}: {
  subjectId: string;
  folders: EyebrowFolder[];
  folderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const folder = folders.find((f) => f.id === folderId) ?? null;
  const viz = folderVisual(
    folder
      ? { slug: folder.slug, color: folder.color, icon: folder.icon }
      : "general",
  );

  function setFolder(nextId: string | null) {
    if (nextId === folderId) return;
    const precedent = folderId;
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, { folderId: nextId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
      const nom =
        nextId == null
          ? "sans dossier"
          : `dans ${folders.find((f) => f.id === nextId)?.path ?? "ce dossier"}`;
      toast.success(`Sujet rangé ${nom}`, {
        duration: 8000,
        action: {
          label: "Annuler",
          onClick: () => {
            startTransition(async () => {
              const back = await updateSubjectAction(subjectId, {
                folderId: precedent,
              });
              if (back.ok) {
                toast.success("Remis où il était");
                router.refresh();
              } else toast.error(back.message);
            });
          },
        },
      });
    });
  }

  return (
    <>
      {/* 44 px de frappe par le pseudo-élément, sans grossir la ligne. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Changer le dossier : ${folder?.path ?? "sans dossier"}`}
        className="relative inline-flex max-w-full items-center gap-2 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] active:opacity-80"
      >
        <i
          aria-hidden
          className="h-2 w-5 flex-none rounded-full"
          style={{ background: viz.color }}
        />
        <span className="truncate">{folder?.path ?? "Sans dossier"}</span>
        <ChevronDown
          className="size-3 flex-none text-white/70"
          strokeWidth={2.6}
          aria-hidden
        />
      </button>

      <RangerDansSheet
        open={open}
        onOpenChange={setOpen}
        sousTitre={`Ce sujet · aujourd’hui ${folder ? `dans ${folder.path}` : "sans dossier"}`}
        dossiers={folders}
        actuel={folderId}
        racine="grisee"
        sansDossier
        onChoix={setFolder}
      />
    </>
  );
}
