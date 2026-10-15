"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { reconnectChannelAction } from "@/server/actions/channels";

// Reconnecter (ré-auth du même compte, sans perte) : une puce qui dit son mot,
// à la place du badge d'état quand le canal n'est pas connecté — l'état devient
// le geste. Jamais un glyphe de rotation seul, qui se lisait « rafraîchir »
// (PITFALLS #53).

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
      className="pressable relative inline-flex h-9 flex-none items-center rounded-(--rayon-pilule) border border-(--filet) bg-white px-3 text-[12px] font-medium text-noir shadow-carte before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-50"
    >
      {pending ? "Ouverture…" : "Reconnecter"}
    </button>
  );
}
