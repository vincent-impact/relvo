"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { migrerBoiteAction } from "@/server/actions/channels";

// Passer une boîte de l'agrégateur au relais Gmail (M24.9) : la même puce que
// « Reconnecter », qui dit son geste — relier la boîte à nouveau, avec Google.
// Montrée seulement quand la migration a été proposée à ce compte ; la boîte
// continue par l'agrégateur jusqu'au retour de Google.

export function ChannelMigrateButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await migrerBoiteAction(channelId, "canaux");
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
      aria-label={`Relier la boîte ${channelName} avec Google`}
      className="pressable relative inline-flex h-9 flex-none items-center rounded-(--rayon-pilule) border border-(--filet) bg-white px-3 text-[12px] font-medium text-noir shadow-carte before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-50"
    >
      {pending ? "Ouverture…" : "Relier avec Google"}
    </button>
  );
}
