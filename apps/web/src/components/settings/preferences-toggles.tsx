"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// Préférences (Réglages, Direction B) — toggles Brief quotidien / Suggestions
// auto / Notifications push / Lecture vocale. Coquille M9 : pas de modèle de
// préférences côté Account, l'état est local et non persisté (persistance à venir).

const PREFS = [
  {
    key: "brief",
    label: "Brief quotidien",
    desc: "Recevoir le récapitulatif du matin",
    default: true,
  },
  {
    key: "suggestions",
    label: "Suggestions automatiques",
    desc: "Laisser Relvo préparer des réponses et tâches",
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

export function PreferencesToggles() {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map((p) => [p.key, p.default])),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-(--border-light) bg-white shadow-(--shadow-card)">
      {PREFS.map((p, i) => (
        <div
          key={p.key}
          className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-(--border-light)" : ""}`}
        >
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
