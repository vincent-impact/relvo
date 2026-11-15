"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// HeaderSwitch — le petit segmented posé DANS le ciel, sur la rangée des
// boutons, blanc translucide, pilule : Semaine / Mois du Calendrier, Mois / Tout du Bilan.
// Deux ou trois liens : le choix vit dans l'URL, la page est linkable et le
// retour arrière retombe sur la bonne vue. Compact pour tenir à côté du titre
// et d'un bouton de page sur un téléphone étroit.
//
// `retenir` : le choix se RETIENT sur l'appareil, dans un cookie de ce nom —
// l'interrupteur Sujets / Dossiers. Un cookie et non le stockage local : le
// serveur le lit, et la page arrive d'emblée sur la bonne vue, sans sursaut.
// L'URL garde la main quand elle porte le choix.

export type HeaderSwitchItem<T extends string> = {
  value: T;
  label: string;
  href: string;
};

export function HeaderSwitch<T extends string>({
  items,
  value,
  retenir,
}: {
  items: HeaderSwitchItem<T>[];
  value: T;
  /** Le nom du cookie où retenir le choix, sur cet appareil. */
  retenir?: string;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-none rounded-(--rayon-pilule) bg-white/14 p-[3px]"
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Link
            key={it.value}
            href={it.href}
            role="tab"
            aria-selected={active}
            onClick={
              retenir
                ? () => {
                    document.cookie = `${retenir}=${it.value}; path=/; max-age=31536000; samesite=lax`;
                  }
                : undefined
            }
            className={cn(
              "relative rounded-(--rayon-pilule) px-3 py-[5px] text-[13px] whitespace-nowrap before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
              active
                ? "bg-white font-medium text-relvo"
                : "font-normal text-white",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
