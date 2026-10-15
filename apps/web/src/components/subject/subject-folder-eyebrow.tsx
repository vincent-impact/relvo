"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateSubjectAction } from "@/server/actions/subjects";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// La ligne du dessus de la fiche d'un sujet : la bande et le nom de son
// domaine, dans le ciel, comme sur sa ligne — et c'est AUSSI le geste qui le
// change. Le domaine n'est dit qu'une fois sur la fiche (02-composants, « un
// même chiffre n'est jamais rendu deux fois » vaut pour un mot) : la puce qui
// le répétait sous les onglets a disparu, son sélecteur est monté ici.

export type EyebrowFolder = {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  icon: string | null;
};

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
    setOpen(false);
    if (nextId === folderId) return;
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, { folderId: nextId });
      if (res.ok) {
        toast.success("Domaine mis à jour");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      {/* 44 px de frappe par le pseudo-élément, sans grossir la ligne. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Changer le domaine : ${folder?.name ?? "non classé"}`}
        className="relative inline-flex max-w-full items-center gap-2 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] active:opacity-80"
      >
        <i
          aria-hidden
          className="h-2 w-5 flex-none rounded-full"
          style={{ background: viz.color }}
        />
        <span className="truncate">{folder?.name ?? "Non classé"}</span>
        <ChevronDown
          className="size-3 flex-none text-white/70"
          strokeWidth={2.6}
          aria-hidden
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Domaine du sujet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFolder(null)}
              className={cn(
                "inline-flex h-9 items-center rounded-(--rayon-pilule) border px-3.5 text-[13px] font-medium transition-colors",
                folderId == null
                  ? "border-noir bg-noir text-white"
                  : "border-(--filet) bg-white text-noir",
              )}
            >
              Non classé
            </button>
            {folders.map((f) => {
              const v = folderVisual({
                slug: f.slug,
                color: f.color,
                icon: f.icon,
              });
              const active = folderId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-(--rayon-pilule) border px-3.5 text-[13px] font-medium transition-colors",
                    active
                      ? "border-noir bg-noir text-white"
                      : "border-(--filet) bg-white text-noir",
                  )}
                >
                  <i
                    aria-hidden
                    className="size-2 flex-none rounded-[2px]"
                    style={{ background: v.color }}
                  />
                  {f.name}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
