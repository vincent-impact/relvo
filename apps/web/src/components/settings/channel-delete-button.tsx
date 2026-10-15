"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@/components/shared/picto";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteChannelAction } from "@/server/actions/channels";

// Retirer un canal — l'action la plus destructrice du produit (les messages
// reçus par ce canal sont effacés de Relvo). Elle ne se tient donc pas en
// corbeille nue à douze pixels d'un badge sur chaque ligne : un lien en pied de
// page, qui fait choisir le canal, puis confirme en le nommant.

export type RemovableChannel = { id: string; name: string; identifier: string };

export function ChannelRemoveLink({
  channels,
}: {
  channels: RemovableChannel[];
}) {
  const [choosing, setChoosing] = useState(false);
  const [target, setTarget] = useState<RemovableChannel | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (channels.length === 0) return null;

  function run() {
    const ch = target;
    if (!ch) return;
    startTransition(async () => {
      const res = await deleteChannelAction(ch.id);
      if (res.ok) {
        toast.success(`« ${ch.name} » retiré.`);
        setTarget(null);
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
        onClick={() => setChoosing(true)}
        className="mx-auto mt-6 flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium text-urgent"
      >
        <Trash className="size-[15px]" />
        Retirer un canal…
      </button>

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="gap-3 p-5">
          <DialogHeader>
            <DialogTitle>Quel canal retirer ?</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-(--rayon-carte) border border-(--filet)">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setChoosing(false);
                  setTarget(ch);
                }}
                className="flex h-13 w-full items-center gap-3 border-b border-(--filet) px-3.5 text-left last:border-b-0 active:bg-(--fond-enfonce)"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-normal text-noir">
                    {ch.name}
                  </span>
                  <span className="block truncate text-[12px] font-normal text-gris">
                    {ch.identifier}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={target !== null}
        onOpenChange={(o) => !o && !pending && setTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer « {target?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les messages et pièces jointes reçus par ce canal seront effacés
              de Relvo, et le compte sera déconnecté. Cette action ne se défait
              pas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              disabled={pending}
              className="bg-urgent text-white"
            >
              {pending ? "Retrait…" : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
