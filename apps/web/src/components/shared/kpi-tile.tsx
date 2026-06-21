import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Tuile KPI de l'Accueil (« Vue du jour »). Grille 2×2 sur mobile.
// `tone="urgent"` : fond rouge tant que value > 0 (signal rare), neutre à 0.

export function KpiTile({
  value,
  label,
  meta,
  icon: Icon,
  tone = "default",
}: {
  value: number;
  label: string;
  meta?: string;
  icon: LucideIcon;
  tone?: "default" | "urgent";
}) {
  const urgent = tone === "urgent" && value > 0;
  return (
    <div
      className={cn(
        "relative rounded-[14px] border bg-white px-3.5 py-3 shadow-(--shadow-card)",
        urgent ? "border-(--red-200) bg-(--red-50)" : "border-(--border-light)",
      )}
    >
      {/* Maquette : chiffre + icône collés (gap), icône non poussée à droite. */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[30px] leading-none font-bold tracking-[-1.2px]",
            urgent && "text-(--red-600)",
          )}
        >
          {value}
        </span>
        <Icon className="size-[26px] text-(--text-secondary)" strokeWidth={2} />
      </div>
      <div className="mt-1.5 text-[13px] text-(--text-secondary)">{label}</div>
      {meta ? (
        <div className="mt-0.5 truncate text-[11px] text-(--text-tertiary)">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
