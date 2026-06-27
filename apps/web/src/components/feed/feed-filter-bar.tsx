"use client";

import { Flag } from "lucide-react";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtres rapides de Mon fil (Direction B) — rangée de chips défilable
// horizontalement, posée sous les onglets de statut. Raffine la liste de l'onglet
// courant, côté client (instantané) : Urgent, Nouveaux, et un chip par domaine
// présent. « Tous » réinitialise. Couleur de la chip active = sens du filtre
// (rouge urgent, bleu nouveau, couleur du domaine).

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  /** Couleur de remplissage quand la chip est active. */
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors active:scale-95",
        active
          ? "border-transparent text-white"
          : "border-(--border) bg-white text-(--text-secondary)",
      )}
      style={active ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

export function FeedFilterBar({
  urgent,
  onUrgent,
  nouveaux,
  onNouveaux,
  domains,
  selectedDomains,
  onToggleDomain,
  folderNames,
  anyActive,
  onReset,
}: {
  urgent: boolean;
  onUrgent: () => void;
  nouveaux: boolean;
  onNouveaux: () => void;
  /** Slugs des domaines présents dans l'onglet courant. */
  domains: string[];
  selectedDomains: string[];
  onToggleDomain: (slug: string) => void;
  folderNames: Record<string, string>;
  anyActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-4 pt-3.5 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={!anyActive} color="var(--relvo)" onClick={onReset}>
        Tous
      </Chip>
      <Chip active={urgent} color="var(--red-600)" onClick={onUrgent}>
        <Flag className="size-3" fill="currentColor" strokeWidth={0} />
        Urgent
      </Chip>
      <Chip active={nouveaux} color="var(--brand)" onClick={onNouveaux}>
        Nouveaux
      </Chip>
      {domains.map((slug) => {
        const { color, icon: Icon } = folderVisual(slug);
        return (
          <Chip
            key={slug}
            active={selectedDomains.includes(slug)}
            color={color}
            onClick={() => onToggleDomain(slug)}
          >
            <Icon className="size-[14px]" strokeWidth={2.2} />
            {folderNames[slug] ?? slug}
          </Chip>
        );
      })}
    </div>
  );
}
