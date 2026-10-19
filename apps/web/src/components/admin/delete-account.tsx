"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash } from "@/components/shared/picto";
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
import { Input } from "@/components/ui/input";
import { adminDeleteAccountAction } from "@/server/actions/admin";

// Supprimer un compte (M21.4) — la seule opération irréversible du produit. Un
// lien en pied de fiche, rouge ; la confirmation fait RETAPER l'e-mail du
// compte : pas une case à cocher, une preuve qu'on sait ce qu'on supprime.
// Primitive `alert-dialog` du registre, couleurs posées (PITFALLS #51).

export function DeleteAccount({
  accountId,
  email,
}: {
  accountId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pret = saisie.trim().toLowerCase() === email.toLowerCase();

  function run() {
    startTransition(async () => {
      const res = await adminDeleteAccountAction(accountId, saisie);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const echecs = res.data.unipile.echecs.length;
      toast.success(
        echecs
          ? `${res.data.email} supprimé. ${echecs} compte(s) Unipile n'ont pas pu être déconnectés : finir dans le dashboard.`
          : `${res.data.email} supprimé.`,
        { duration: echecs ? 12_000 : 5_000 },
      );
      setOpen(false);
      router.replace("/admin");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto mt-8 flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium text-urgent"
      >
        <Trash className="size-[15px]" />
        Supprimer ce compte…
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (!o) setSaisie("");
        }}
      >
        <AlertDialogContent className="bg-white text-(--text-primary) ring-(--hairline)">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-(--red-50) text-(--red-600)">
              <Trash />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Supprimer définitivement ce compte ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ses canaux seront déconnectés chez l&apos;agrégateur, puis tout ce
              qu&apos;il contient — affaires, conversations, messages, pièces
              jointes, documents, journal — sera effacé. Il n&apos;y a pas de
              corbeille. Pour confirmer, retapez son adresse :{" "}
              <span className="font-medium text-noir">{email}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="adresse@exemple.fr"
            autoComplete="off"
            autoCapitalize="none"
            inputMode="email"
            aria-label="Adresse e-mail du compte à supprimer"
            className="h-11 text-[15px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              disabled={!pret || pending}
              className="bg-urgent text-white"
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
