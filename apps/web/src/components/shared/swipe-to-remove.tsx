"use client";

import { useRef, useState } from "react";
import { EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Swipe-left générique « Retirer » (Direction B) — glisser vers la GAUCHE révèle
// un fond rouge ; au-delà du seuil, l'élément se replie et `onRemove` est appelé.
// Un tap (sans glissé) déclenche `onTap`. Réutilisable hors du feed des sujets.
// `icon`/`label` personnalisables (ex. corbeille « Supprimer » pour une tâche).

const THRESHOLD = 80;

export function SwipeToRemove({
  onRemove,
  onTap,
  label = "Retirer",
  icon: Icon = EyeOff,
  children,
}: {
  onRemove: () => void;
  onTap?: () => void;
  label?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const g = useRef({
    sx: 0,
    sy: 0,
    dx: 0,
    active: false,
    decided: false,
    horiz: false,
    moved: false,
  });

  function setX(x: number, animate = false) {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform .2s ease" : "none";
    el.style.transform = `translateX(${x}px)`;
  }

  function onPointerDown(e: React.PointerEvent) {
    const s = g.current;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.dx = 0;
    s.active = true;
    s.decided = false;
    s.horiz = false;
    s.moved = false;
    cardRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s.active) return;
    const mx = e.clientX - s.sx;
    const my = e.clientY - s.sy;
    if (!s.decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.decided = true;
      s.horiz = Math.abs(mx) > Math.abs(my);
    }
    if (s.decided && s.horiz) {
      s.moved = true;
      const dx = Math.min(0, mx); // gauche uniquement
      s.dx = dx;
      setX(dx);
    }
  }

  function onPointerEnd() {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    if (s.horiz && s.dx < -THRESHOLD) {
      setX(-window.innerWidth, true);
      setLeaving(true);
      onRemove();
    } else {
      if (!s.moved) onTap?.();
      setX(0, true);
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300",
        leaving ? "max-h-0 opacity-0" : "max-h-[600px]",
      )}
    >
      <div className="relative overflow-hidden">
        {/* Fond Retirer (rouge), révélé en glissant à gauche : libellé à droite. */}
        <div className="absolute inset-0 flex items-center justify-end gap-2 bg-brand-accent pr-6 text-white">
          <span className="text-[11px] font-bold tracking-[0.3px]">
            {label}
          </span>
          <Icon className="size-[22px]" strokeWidth={2} />
        </div>
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className="relative flow-root touch-pan-y bg-white"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
