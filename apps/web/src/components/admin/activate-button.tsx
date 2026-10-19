"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminActivateAction } from "@/server/actions/admin";

// Ouvrir l'accès d'un compte en attente (M21.6) : la validation de la demande,
// d'un appui. La personne reçoit l'e-mail qui lui dit de revenir.

export function ActivateButton({
  accountId,
  email,
  className,
}: {
  accountId: string;
  email: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      className={className ?? "bg-relvo text-white hover:bg-relvo/90"}
      onClick={() =>
        startTransition(async () => {
          const res = await adminActivateAction(accountId);
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(
            res.data.changed
              ? `Accès ouvert pour ${email}. Un e-mail lui a été envoyé.`
              : `${email} avait déjà son accès.`,
          );
          router.refresh();
        })
      }
    >
      {pending ? "Ouverture…" : "Ouvrir l'accès"}
    </Button>
  );
}
