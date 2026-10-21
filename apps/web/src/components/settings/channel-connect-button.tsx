"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { reprendreConnexionAction } from "@/server/actions/channels";

// Connecter un canal JAMAIS CONNECTÉ : l'utilisateur est revenu en arrière de
// la page du fournisseur, le canal est resté « en attente » sans compte. Le
// badge devient le geste — la même puce que « Reconnecter » (PITFALLS #53,
// #70) — et rouvre la page du fournisseur sur le même canal, le même choix.

export function ChannelConnectButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await reprendreConnexionAction(channelId);
      if (res.ok) {
        window.location.href = res.data.url;
        return;
      }
      toast.error(res.message);
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      aria-label={`Connecter le canal ${channelName}`}
      className="pressable relative inline-flex h-9 flex-none items-center rounded-(--rayon-pilule) px-3 text-[12px] font-medium text-white before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-50"
      style={{ background: "var(--degrade-relvo)" }}
    >
      {pending ? "Ouverture…" : "Connecter"}
    </button>
  );
}
