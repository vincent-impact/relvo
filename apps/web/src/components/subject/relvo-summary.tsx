"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Résumé de Relvo (violet) en tête de fiche, clampé à 3 lignes avec « Voir plus ».

export function RelvoSummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3.5 rounded-xl border border-(--purple-100) bg-relvo-bg p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-relvo">
        <span>✦</span> Résumé de Relvo
      </div>
      <p className={cn("text-[14px] text-brand-dark", !open && "line-clamp-3")}>
        {text}
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 text-[12.5px] font-semibold text-relvo"
        >
          Voir plus
        </button>
      ) : null}
    </div>
  );
}
