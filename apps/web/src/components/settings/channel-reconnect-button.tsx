"use client";

import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { reconnectChannelAction } from "@/server/actions/channels";

// Reconnexion d'un canal (Réglages → Canaux, M6quater). Ré-authentifie le MÊME
// compte Unipile (hosted auth mode « reconnect ») : aucune donnée perdue,
// contrairement à la suppression. À utiliser quand un canal tombe en « Erreur »
// (identifiants expirés / révoqués, ou envoi refusé par le fournisseur).

export function ChannelReconnectButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await reconnectChannelAction(channelId);
      if (res.ok) {
        // Redirection vers le parcours hosted auth d'Unipile.
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
      aria-label={`Reconnecter le canal ${channelName}`}
      title="Reconnecter"
      className="grid size-8 flex-none place-items-center rounded-lg text-(--text-tertiary) transition-colors hover:bg-(--blue-50) hover:text-brand disabled:opacity-50"
    >
      <RotateCw
        className={`size-[16px] ${pending ? "animate-spin" : ""}`}
        strokeWidth={2}
      />
    </button>
  );
}
