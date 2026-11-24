"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type TrouData, phraseDuRetour, trouARelire } from "@/lib/trou";
import { relireLeTrouAction } from "@/server/actions/conversations";

// Le trou d'une conversation ACTIVE (M25.10), en tête de son fil, sur le
// violet : ce qu'elle a reçu pendant qu'elle était ignorée n'est pas dans
// Relvo, et un geste le relit chez le fournisseur. N'apparaît que lorsque la
// relecture faite au retour n'a pas abouti — sinon il n'y a plus de trou.

export function TrouARelire({
  conversationId,
  trou,
}: {
  conversationId: string;
  trou: TrouData;
}) {
  const [pending, startTransition] = useTransition();
  function relire() {
    startTransition(async () => {
      const res = await relireLeTrouAction(conversationId);
      const retour = res.data.retour;
      if (!retour) return;
      if (retour.complet) toast.success(phraseDuRetour(retour));
      else toast.error(phraseDuRetour(retour));
    });
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[12.5px] leading-[1.4] text-white">
      <p className="min-w-0 flex-1">{trouARelire(trou)}</p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={relire}
        className="flex-none"
      >
        {pending ? "Lecture…" : "Les relire"}
      </Button>
    </div>
  );
}
