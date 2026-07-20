"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteContactAction } from "@/server/actions/contacts";

// Suppression d'un contact depuis sa fiche. HARD-DELETE : le contact quitte
// l'annuaire (les messages restent, ils redeviennent « expéditeur brut »). On
// confirme via la modale partagée, puis on revient à l'annuaire.

export function ContactDeleteButton({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await deleteContactAction(contactId);
      if (res.ok) {
        toast.success("Contact supprimé");
        router.push("/contacts");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-4 mt-4 inline-flex items-center gap-1.5 rounded-xl border border-(--red-200) px-4 py-2.5 text-[14px] font-bold text-(--red-600) active:opacity-90"
      >
        <Trash2 className="size-4" strokeWidth={2.2} />
        Supprimer le contact
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        icon={Trash2}
        title={`Supprimer « ${contactName} » ?`}
        description="Le contact est retiré de l'annuaire. Ses messages sont conservés (l'expéditeur redevient brut). Action irréversible."
        confirmLabel={pending ? "Suppression…" : "Supprimer"}
        pending={pending}
        onConfirm={run}
      />
    </>
  );
}
