"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package } from "@/components/shared/picto";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { compte, octets } from "@/lib/stockage";
import { adminDedoublonnerAction } from "@/server/actions/admin";

// Dédoublonner le stock (M25.8) — un geste d'administration, confirmé : un
// même fichier stocké plusieurs fois dans un compte n'est gardé qu'une fois,
// les autres exemplaires sont effacés du stockage. Chaque pièce garde son
// fichier ; ce qui part ne revient pas. Primitive `alert-dialog` du registre,
// couleurs posées (PITFALLS #51).

export function Dedoublonner({
  fichiers,
  poids,
}: {
  /** Ce que la dernière lecture du bucket a compté de doublons. */
  fichiers: number;
  poids: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res = await adminDedoublonnerAction();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const { bilan, echecs } = res.data;
      toast.success(
        bilan.fichiersLiberes
          ? `${compte(bilan.fichiersLiberes, "fichier en double retiré", "fichiers en double retirés")} · ${octets(bilan.octetsLiberes)} libérés.${echecs ? ` ${compte(echecs, "compte", "comptes")} en erreur.` : ""}`
          : "Aucun doublon à retirer.",
        { duration: 9_000 },
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Dédoublonner…
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!pending) setOpen(o);
        }}
      >
        <AlertDialogContent className="bg-white text-(--text-primary) ring-(--hairline)">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-relvo-pale text-relvo">
              <Package />
            </AlertDialogMedia>
            <AlertDialogTitle>Dédoublonner le stock ?</AlertDialogTitle>
            <AlertDialogDescription>
              Dans chaque compte, un même fichier stocké plusieurs fois ne sera
              gardé qu&apos;une fois : toutes les pièces qui le portent
              pointeront vers cet exemplaire, et les autres seront effacés du
              stockage. Aucune pièce ne perd son fichier ; les exemplaires
              effacés ne reviennent pas. D&apos;après la dernière lecture du
              bucket :{" "}
              <span className="font-medium text-noir">
                {compte(fichiers, "fichier", "fichiers")} en double,{" "}
                {octets(poids)}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={run} disabled={pending}>
              {pending ? "Déduplication…" : "Dédoublonner"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
