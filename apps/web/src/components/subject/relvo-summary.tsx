"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Ce que Relvo a compris d'un sujet (05 §1.6) : la SITUATION structurée en
// quatre lignes — où on en est, la prochaine étape, de qui on attend quoi,
// l'échéance qui compte — puis le RÉSUMÉ libre, clampé à 3 lignes avec « Voir
// plus ». Le bouton n'apparaît QUE si le texte déborde réellement (mesure
// clientHeight vs scrollHeight). Deux tons : `hero` (verre blanc translucide,
// dans la zone violette) et `card` (carte violet pâle sur fond clair).

export type SituationLine = { label: string; value: string | null };

export function RelvoSummary({
  text,
  situation = [],
  footer,
  tone = "hero",
}: {
  text: string | null;
  /** Lignes de la situation structurée ; les valeurs nulles ne s'affichent pas. */
  situation?: SituationLine[];
  /** « Relu il y a 2 h ». */
  footer?: string | null;
  tone?: "hero" | "card";
}) {
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const pRef = useRef<HTMLParagraphElement>(null);
  const hero = tone === "hero";
  const lignes = situation.filter((l) => l.value);

  // Détecte le débordement dans l'état clampé (avant toute expansion).
  useLayoutEffect(() => {
    const el = pRef.current;
    if (el && !open) setOverflowing(el.scrollHeight - el.clientHeight > 1);
  }, [text, open]);

  if (!text && lignes.length === 0) return null;

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
        {lignes.length ? "Ce que Relvo a compris" : "Résumé de Relvo"}
      </div>

      {lignes.length ? (
        <dl
          className={cn(
            "mb-2 space-y-1 text-[13.5px] leading-[1.45]",
            hero ? "text-white" : "text-brand-dark",
          )}
        >
          {lignes.map((l) => (
            <div key={l.label} className="flex gap-2">
              <dt
                className={cn(
                  "w-[104px] flex-none text-[11.5px] font-bold tracking-[0.2px] uppercase",
                  hero ? "text-white/75" : "text-relvo/80",
                )}
              >
                {l.label}
              </dt>
              <dd className="min-w-0 flex-1">{l.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {text ? (
        <p
          ref={pRef}
          className={cn(
            "text-[14px] leading-[1.45]",
            hero ? "text-white" : "text-brand-dark",
            !open && "line-clamp-3",
          )}
        >
          {text}
        </p>
      ) : null}
      {text && !open && overflowing ? (
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
      {footer ? (
        <p
          className={cn(
            "mt-2 text-[11.5px]",
            hero ? "text-white/70" : "text-(--text-tertiary)",
          )}
        >
          {footer}
        </p>
      ) : null}
    </div>
  );
}
