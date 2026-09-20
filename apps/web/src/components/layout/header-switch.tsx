import Link from "next/link";
import { cn } from "@/lib/utils";

// HeaderSwitch — le petit segmented posé DANS le header violet, sur la ligne du
// titre, en verre clair : Semaine / Mois du Calendrier, Mois / Tout du Bilan.
// Deux ou trois liens : le choix vit dans l'URL, la page est linkable et le
// retour arrière retombe sur la bonne vue. Compact pour tenir à côté du titre
// et d'un bouton de page sur un téléphone étroit.

export type HeaderSwitchItem<T extends string> = {
  value: T;
  label: string;
  href: string;
};

export function HeaderSwitch<T extends string>({
  items,
  value,
}: {
  items: HeaderSwitchItem<T>[];
  value: T;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-none rounded-[9px] p-[2px]"
      style={{
        background: "rgb(255 255 255 / 0.14)",
        border: "1px solid rgb(255 255 255 / 0.22)",
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Link
            key={it.value}
            href={it.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-[7px] px-2.5 py-[5px] text-[12px] font-semibold whitespace-nowrap",
              active ? "bg-[#fafafa] text-relvo" : "text-white",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
