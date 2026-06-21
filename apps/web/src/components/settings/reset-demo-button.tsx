"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { resetDemoAction } from "@/server/actions/demo";

// Bouton de reset du compte démo (Réglages → Session), visible uniquement pour
// le compte de démonstration. Confirme via AlertDialog, puis rejoue le seed
// (mêmes données neuves que `pnpm db:seed`) en gardant la session valide.

export function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res = await resetDemoAction();
      if (res.ok) {
        toast.success("Compte démo réinitialisé — données neuves.");
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
          <Button variant="outline" className="w-full">
            <RotateCcw className="size-4" />
            Réinitialiser le compte démo
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Repartir de données neuves ?</AlertDialogTitle>
          <AlertDialogDescription>
            Toutes tes modifications sur le compte démo (sujets traités, tâches
            cochées, messages…) seront effacées et remplacées par le jeu de
            démonstration Tasty Crousty d'origine. Action irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={run} disabled={pending}>
            {pending ? "Réinitialisation…" : "Réinitialiser"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
