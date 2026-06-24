"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Résumé de Relvo en tête de fiche, clampé à 3 lignes avec « Voir plus ».
// Deux tons : `hero` (verre blanc translucide, posé dans la zone agent violette)
// et `card` (carte violet pâle sur fond clair).

export function RelvoSummary({
  text,
  tone = "hero",
}: {
  text: string;
  tone?: "hero" | "card";
}) {
  const [open, setOpen] = useState(false);
  const hero = tone === "hero";
  return (
    <div
      className={cn(
        "rounded-2xl p-3.5",
        hero
          ? "border border-white/20 bg-white/15"
          : "border border-(--purple-100) bg-relvo-bg",
      )}
    >
      <div
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-[12px] font-bold tracking-[0.3px] uppercase",
          hero ? "text-white/90" : "text-relvo",
        )}
      >
        <Sparkles className="size-3.5" fill="currentColor" strokeWidth={0} />
        Résumé de Relvo
      </div>
      <p
        className={cn(
          "text-[14px] leading-[1.45]",
          hero ? "text-white" : "text-brand-dark",
          !open && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "mt-1.5 text-[12.5px] font-semibold",
            hero ? "text-white/85" : "text-relvo",
          )}
        >
          Voir plus
        </button>
      ) : null}
    </div>
  );
}
