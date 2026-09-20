"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setAssistantEnabledAction } from "@/server/actions/preferences";

// Préférences (page du menu). Le premier réglage PERSISTÉ est l'assistant : il
// gouverne tout ce que Relvo fait de lui-même sur le compte (M7) — le tri à
// l'arrivée aujourd'hui, la structuration, la relecture et l'échange demain.
// Les autres toggles restent la coquille M9 : état local, non persisté.

const PREFS = [
  {
    key: "brief",
    label: "Brief quotidien",
    desc: "Recevoir le récapitulatif du matin",
    default: true,
  },
  {
    key: "push",
    label: "Notifications push",
    desc: "Être alerté des sujets urgents",
    default: false,
  },
  {
    key: "voice",
    label: "Lecture vocale",
    desc: "Lire les réponses de Relvo à voix haute",
    default: false,
  },
];

const ROW = "flex items-center gap-3 px-4 py-3.5";

export function PreferencesToggles({
  assistantEnabled,
}: {
  assistantEnabled: boolean;
}) {
  const [assistant, setAssistant] = useState(assistantEnabled);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map((p) => [p.key, p.default])),
  );

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
    <div className="overflow-hidden rounded-2xl border border-(--border-light) bg-white shadow-(--shadow-card)">
      <div className={ROW}>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">Assistant Relvo</div>
          <div className="mt-0.5 text-[12.5px] text-(--text-tertiary)">
            Relvo lit les messages reçus, ouvre les sujets qui le méritent et
            prépare le travail. Coupé, les messages arrivent quand même et vous
            triez à la main.
          </div>
        </div>
        <Switch
          checked={assistant}
          disabled={pending}
          onCheckedChange={toggleAssistant}
          aria-label="Assistant Relvo"
        />
      </div>
      {PREFS.map((p) => (
        <div key={p.key} className={`${ROW} border-t border-(--border-light)`}>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">{p.label}</div>
            <div className="mt-0.5 text-[12.5px] text-(--text-tertiary)">
              {p.desc}
            </div>
          </div>
          <Switch
            checked={state[p.key]}
            onCheckedChange={(v) => {
              setState((s) => ({ ...s, [p.key]: v }));
              toast.info("La persistance des préférences arrive bientôt.");
            }}
          />
        </div>
      ))}
    </div>
  );
}
