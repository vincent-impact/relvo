"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtres rapides de Mon fil (Direction B) — UNE seule rangée de chips
// défilable. Raffine la liste côté client (instantané), 4 dimensions cumulables :
//  - Statut (select)  : Ouvert / Validé / Fermé / Tous  (par défaut Ouvert)
//  - Urgent (toggle)  : marqueur d'urgence
//  - Nouveau (toggle) : marqueur dérivé (jamais ouvert)
//  - Domaine (select) : Tous les domaines / un domaine précis
// Les chips « select » ouvrent un menu (DropdownMenu radio). Les chips « toggle »
// se remplissent à la couleur de leur sens quand actives.

export type Basket = "ouvert" | "valide" | "ferme" | "tous";

const STATUT_OPTIONS: { value: Basket; label: string }[] = [
  { value: "ouvert", label: "Ouvert" },
  { value: "valide", label: "Validé" },
  { value: "ferme", label: "Fermé" },
  { value: "tous", label: "Tous" },
];

// Style de base d'une chip (commun toggle/select).
const CHIP =
  "inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors active:scale-95";

function ToggleChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  /** Couleur de remplissage quand active. */
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
        CHIP,
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

/** Chip-select : déclencheur (libellé + chevron) ouvrant un menu radio. */
function SelectChip({
  label,
  active,
  color,
  children,
}: {
  label: React.ReactNode;
  /** true quand la valeur n'est pas celle par défaut → chip teintée. */
  active: boolean;
  /** Couleur de remplissage quand active (sinon accent Relvo par défaut). */
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          CHIP,
          active
            ? "border-transparent text-white"
            : "border-(--border) bg-white text-(--text-secondary)",
        )}
        style={
          active
            ? { background: color ?? "var(--relvo)", borderColor: color }
            : undefined
        }
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" strokeWidth={2.4} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FeedFilterBar({
  statut,
  onStatut,
  urgent,
  onUrgent,
  nouveau,
  onNouveau,
  domain,
  onDomain,
  domains,
  folderNames,
}: {
  statut: Basket;
  onStatut: (v: Basket) => void;
  urgent: boolean;
  onUrgent: () => void;
  nouveau: boolean;
  onNouveau: () => void;
  /** Slug du domaine filtré, ou null (tous). */
  domain: string | null;
  onDomain: (slug: string | null) => void;
  /** Slugs des domaines présents dans la liste courante. */
  domains: string[];
  folderNames: Record<string, string>;
}) {
  const statutLabel =
    STATUT_OPTIONS.find((o) => o.value === statut)?.label ?? "Ouvert";
  const domainVisual = domain ? folderVisual(domain) : null;

  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-4 pt-3.5 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* Statut — select (par défaut « Ouvert »). */}
      <SelectChip label={statutLabel} active={statut !== "ouvert"}>
        <DropdownMenuRadioGroup
          value={statut}
          onValueChange={(v) => onStatut(v as Basket)}
        >
          {STATUT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </SelectChip>

      {/* Domaine — select (Tous + un par domaine présent), 2ᵉ position. */}
      {domains.length > 0 ? (
        <SelectChip
          label={
            domainVisual ? (
              <>
                <domainVisual.icon className="size-[14px]" strokeWidth={2.2} />
                {folderNames[domain!] ?? domain}
              </>
            ) : (
              "Domaine"
            )
          }
          active={domain != null}
          color={domainVisual?.color}
        >
          <DropdownMenuRadioGroup
            value={domain ?? "__all__"}
            onValueChange={(v) => onDomain(v === "__all__" ? null : v)}
          >
            <DropdownMenuRadioItem value="__all__">
              Tous les domaines
            </DropdownMenuRadioItem>
            {domains.map((slug) => (
              <DropdownMenuRadioItem key={slug} value={slug}>
                {folderNames[slug] ?? slug}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </SelectChip>
      ) : null}

      {/* Urgent — toggle (libellé seul, sans icône). */}
      <ToggleChip active={urgent} color="var(--red-600)" onClick={onUrgent}>
        Urgent
      </ToggleChip>

      {/* Nouveau — toggle (libellé seul, sans icône). */}
      <ToggleChip active={nouveau} color="var(--brand)" onClick={onNouveau}>
        Nouveau
      </ToggleChip>
    </div>
  );
}
