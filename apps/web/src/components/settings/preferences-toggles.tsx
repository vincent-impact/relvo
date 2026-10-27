"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setAssistantEnabledAction } from "@/server/actions/preferences";

// Une seule ligne : l'assistant. Les autres réglages (brief quotidien,
// notifications, lecture vocale) reviendront avec leur fonction — un
// interrupteur qui ne fait rien ne se montre pas, et un produit ne s'excuse
// pas à chaque tap.

export function PreferencesToggles({
  assistantEnabled,
}: {
  assistantEnabled: boolean;
}) {
  const [assistant, setAssistant] = useState(assistantEnabled);
  const [pending, startTransition] = useTransition();

  function toggleAssistant(next: boolean) {
    const previous = assistant;
    setAssistant(next);
    startTransition(async () => {
      const result = await setAssistantEnabledAction(next);
      if (!result.ok) {
        setAssistant(previous);
        toast.error("Le réglage n'a pas pu être enregistré.");
        return;
      }
      toast.success(
        next
          ? "Relvo travaille désormais sur vos messages reçus."
          : "Relvo ne touche plus à vos messages. Vous triez à la main.",
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-normal text-noir">
            Assistant Relvo
          </div>
          <div className="mt-0.5 text-[14px] leading-5 font-light text-gris">
            Relvo lit les messages reçus, ouvre les sujets qui le méritent et
            prépare le travail. Coupé, les messages arrivent quand même et vous
            triez à la main.
          </div>
        </div>
        <Switch
          size="lg"
          checked={assistant}
          disabled={pending}
          onCheckedChange={toggleAssistant}
          aria-label="Assistant Relvo"
        />
      </label>
    </div>
  );
}
