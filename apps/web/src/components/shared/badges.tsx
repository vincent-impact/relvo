import { Flag, Hourglass, Sparkles, SquareCheck } from "lucide-react";
import type { SubjectStatus } from "@relvo/db";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Badges & marqueurs partagés (cf. invariants produit 7/8 + mockup mobile).
// Deux familles DISTINCTES :
//  - StatusBadge = le statut (cycle de vie). Seul `validated` (Validé) est
//    visible ; `open`/`closed` ne rendent rien. « Nouveau » n'est pas un
//    statut : c'est un marqueur dérivé (cf. SubjectRow).
//  - Marqueurs cumulables (Urgent, Nouveau, À faire, En attente, non-lus,
//    suggestions) = composants indépendants, jamais confondus avec le statut.

const STATUS_LABELS: Partial<
  Record<SubjectStatus, { label: string; className: string }>
> = {
  validated: {
    label: "Validé",
    className: "bg-(--green-50) text-(--green-600)",
  },
};

/** Badge de statut (rendu uniquement pour `validated`). */
export function StatusBadge({ status }: { status: SubjectStatus }) {
  const cfg = STATUS_LABELS[status];
  if (!cfg) return null;
  return (
    <Badge className={cn("border-transparent font-semibold", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

/** Drapeau d'urgence (icône seule, rouge) — uniquement si priority = critical. */
export function UrgentFlag({ className }: { className?: string }) {
  return (
    <span
      title="Urgent"
      aria-label="Urgent"
      className={cn("inline-flex items-center text-(--red-600)", className)}
    >
      <Flag className="size-[15px] fill-current" strokeWidth={0} />
    </span>
  );
}

/** Marqueur « À faire » — dérivé de la présence de tâches ouvertes. */
export function TodoBadge() {
  return (
    <Badge className="border-transparent bg-(--amber-50) font-semibold text-(--amber-800)">
      <SquareCheck className="size-3" strokeWidth={2.4} />À faire
    </Badge>
  );
}

/** Marqueur « En attente » — posé par Relvo (waitingForReply). */
export function WaitingBadge() {
  return (
    <Badge className="border-transparent bg-(--surface-2) font-semibold text-(--text-secondary)">
      <Hourglass className="size-3" strokeWidth={2} />
      En attente
    </Badge>
  );
}

/** Marqueur « ✦ N suggérées » (violet Relvo). */
export function SuggestBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge className="border-transparent bg-relvo-bg font-semibold text-relvo">
      <Sparkles className="size-3" strokeWidth={2} />
      {count} suggérée{count > 1 ? "s" : ""}
    </Badge>
  );
}

/** Pastille compteur de messages non-lus (façon WhatsApp). `corner` = ancrée. */
export function UnreadCount({
  count,
  corner = false,
}: {
  count: number;
  corner?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-brand px-[5px] text-[11px] leading-none font-bold text-white",
        corner && "absolute top-3 right-3 z-[1]",
      )}
    >
      {count}
    </span>
  );
}
