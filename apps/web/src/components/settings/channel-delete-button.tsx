"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteChannelAction } from "@/server/actions/channels";

// Suppression d'un canal (Réglages → Canaux). HARD-DELETE assumé : on prévient
// explicitement que messages + pièces jointes reçus via ce canal seront perdus,
// et le compte connecté chez le fournisseur est déconnecté (action serveur).

export function ChannelDeleteButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res = await deleteChannelAction(channelId);
      if (res.ok) {
        toast.success("Canal supprimé.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            aria-label={`Supprimer le canal ${channelName}`}
            className="grid size-8 flex-none place-items-center rounded-lg text-(--text-tertiary) transition-colors hover:bg-(--red-50) hover:text-(--red-600)"
          >
            <Trash2 className="size-[17px]" strokeWidth={2} />
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {channelName} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Tous les messages et pièces jointes reçus via ce canal seront
            <strong> définitivement supprimés</strong>. Le compte connecté chez
            notre fournisseur d’intégration sera déconnecté. Action
            irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            disabled={pending}
            className="bg-(--red-600) text-white hover:bg-(--red-700)"
          >
            {pending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
