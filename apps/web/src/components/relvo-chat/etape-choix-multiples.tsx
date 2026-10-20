"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtapeOption } from "@/components/relvo-chat/etape-formulaire";

// EtapeChoixMultiples — une question de Relvo dont on garde PLUSIEURS réponses
// (les domaines typiques de la prise en main, 05 §9.6) : les mêmes options
// blanches à filet qu'`EtapeFormulaire`, qui se cochent au lieu de répondre,
// puis un bouton qui envoie ce qui est coché. Registre interrogé : `checkbox`
// et `toggle-group` existent, mais une case à cocher à gauche d'un libellé
// n'est pas la forme des réponses de Relvo ; on compose sur l'option de
// l'étape, avec la coche à la place du chevron. Les réponses secondaires
// (« Aucun pour l'instant ») répondent seules, comme dans le formulaire.

export function EtapeChoixMultiples<K extends string>({
  question,
  options,
  onChoose,
  confirmLabel = "Garder ceux-là",
  busy = false,
  error = null,
}: {
  question: React.ReactNode;
  options: EtapeOption<K>[];
  /** Les clés cochées (bouton), ou une réponse secondaire seule. */
  onChoose: (keys: K[]) => void;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
}) {
  const [cochees, setCochees] = useState<Set<K>>(() => new Set());
  const primary = options.filter((o) => !o.secondary);
  const secondary = options.filter((o) => o.secondary);
  const basculer = (k: K) =>
    setCochees((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <div>
      <p className="mt-1.5 text-[15px] leading-[21px] font-normal text-noir">
        {question}
      </p>
      <div className="mt-2.5 space-y-1.5">
        {primary.map((o) => {
          const coche = cochees.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              role="checkbox"
              aria-checked={coche}
              onClick={() => basculer(o.key)}
              disabled={busy}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-(--rayon-option) border bg-white px-3.5 text-left",
                "transition-[background-color,border-color,opacity] active:bg-(--fond-enfonce) disabled:opacity-60",
                coche ? "border-relvo" : "border-(--filet)",
              )}
            >
              <span className="min-w-0 flex-1 py-2">
                <span className="block text-[14.5px] leading-[18px] font-normal text-noir">
                  {o.label}
                </span>
                {o.hint ? (
                  <span className="block text-[12px] leading-4 font-normal text-gris">
                    {o.hint}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={cn(
                  "grid size-5 flex-none place-items-center rounded-full border transition-[background-color,border-color]",
                  coche
                    ? "border-relvo bg-relvo text-white"
                    : "border-(--gris-clair) bg-white text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-[12px] leading-4 font-normal text-urgent">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => onChoose([...cochees])}
        disabled={busy || cochees.size === 0}
        className="pressable mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-(--rayon-pilule) text-[14.5px] font-medium text-white disabled:opacity-50"
        style={{ background: "var(--degrade-relvo)" }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {confirmLabel}
        {cochees.size > 0 ? ` (${cochees.size})` : ""}
      </button>
      {secondary.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChoose([o.key])}
          disabled={busy}
          className="mt-1 block w-full py-2 text-center text-[14px] font-medium text-relvo active:opacity-80 disabled:opacity-60"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
