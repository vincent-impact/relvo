import type { Actor } from "@relvo/db";
import { cn } from "@/lib/utils";

// Triptyque d'acteurs Moi / Relvo / Externe (invariant produit n°2).
// Badge avec pastille initiale : M (bleu) / R (violet) / E (ambre).
// `system` est rare en UI ; on le rend comme Relvo (voix de l'agent).

const ACTOR_CONFIG: Record<
  Actor,
  { letter: string; label: string; pill: string; avatar: string }
> = {
  user: {
    letter: "M",
    label: "Moi",
    pill: "bg-(--blue-50) text-(--blue-800)",
    avatar: "bg-brand",
  },
  ai: {
    letter: "R",
    label: "Relvo",
    pill: "bg-relvo-bg text-relvo",
    avatar: "bg-relvo",
  },
  contact: {
    letter: "E",
    label: "Externe",
    pill: "bg-(--amber-50) text-(--amber-800)",
    avatar: "bg-(--amber-600)",
  },
  system: {
    letter: "R",
    label: "Relvo",
    pill: "bg-relvo-bg text-relvo",
    avatar: "bg-relvo",
  },
};

export function ActorPill({
  actor,
  label,
  className,
}: {
  actor: Actor;
  /** Libellé affiché (défaut : Moi / Relvo / Externe). */
  label?: string;
  className?: string;
}) {
  const cfg = ACTOR_CONFIG[actor];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-[7px] py-0.5 text-[11px] font-semibold",
        cfg.pill,
        className,
      )}
    >
      <span
        className={cn(
          "grid size-[15px] place-items-center rounded-full text-[9px] font-extrabold text-white",
          cfg.avatar,
        )}
      >
        {cfg.letter}
      </span>
      {label ?? cfg.label}
    </span>
  );
}
