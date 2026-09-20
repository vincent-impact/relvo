import Link from "next/link";
import { cn } from "@/lib/utils";

// Le segmented Semaine / Mois du Calendrier — posé DANS le header violet, en
// verre clair. Deux liens : la vue vit dans l'URL (`?vue=`), la page est
// linkable et le retour arrière retombe sur la bonne vue.

export type CalendrierVue = "semaine" | "mois";

export function VueSwitch({ vue }: { vue: CalendrierVue }) {
  const items: { value: CalendrierVue; label: string; href: string }[] = [
    { value: "semaine", label: "Semaine", href: "/calendrier" },
    { value: "mois", label: "Mois", href: "/calendrier?vue=mois" },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex rounded-[10px] p-[3px]"
      style={{
        background: "rgb(255 255 255 / 0.14)",
        border: "1px solid rgb(255 255 255 / 0.22)",
      }}
    >
      {items.map((it) => {
        const active = it.value === vue;
        return (
          <Link
            key={it.value}
            href={it.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-[8px] px-4 py-1.5 text-[13px] font-semibold transition-colors",
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
