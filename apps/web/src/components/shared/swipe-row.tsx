"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Swipe BIDIRECTIONNEL (M6ter) — glisser à GAUCHE révèle l'action « left »,
// à DROITE l'action « right ». Chaque sens est OPTIONNEL : sans handler, le
// glissé dans ce sens ne fait rien (utile pour n'exposer qu'un geste selon le
// canal). Un tap franc (sans glissé) déclenche `onTap`.
//
// Même discipline de scroll que `SwipeToRemove` : `onTap` uniquement sur un
// pointerup sans déplacement ; un scroll vertical (pointercancel) n'ouvre rien.

const THRESHOLD = 80;

type SwipeAction = {
  onAct: () => void;
  label: string;
  icon: LucideIcon;
  tone: "danger" | "success" | "warning" | "brand";
  /** Ne PAS replier la ligne au déclenchement — elle revient en place et `onAct`
   *  prend le relais (ex. ouvrir une confirmation avant d'écarter). */
  keepOnAct?: boolean;
};

const TONE_BG: Record<SwipeAction["tone"], string> = {
  danger: "bg-brand-accent",
  success: "bg-(--green-600)",
  warning: "bg-(--amber-600)",
  brand: "bg-brand",
};

export function SwipeRow({
  left,
  right,
  onTap,
  children,
}: {
  left?: SwipeAction;
  right?: SwipeAction;
  onTap?: () => void;
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
      s.moved = true;
    }
    if (s.decided && s.horiz) {
      // On ne suit le doigt que dans un sens ARMÉ (handler présent).
      let dx = mx;
      if (dx < 0 && !left) dx = 0;
      if (dx > 0 && !right) dx = 0;
      s.dx = dx;
      setX(dx);
    }
  }

  function finish(cancelled: boolean) {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    if (s.horiz && s.dx < -THRESHOLD && left) {
      if (left.keepOnAct) {
        // La ligne revient en place ; l'action (confirmation) prend le relais.
        setX(0, true);
        left.onAct();
      } else {
        setX(-window.innerWidth, true);
        setLeaving(true);
        left.onAct();
      }
    } else if (s.horiz && s.dx > THRESHOLD && right) {
      // Le swipe droite ne « retire » pas la ligne : on la remet en place, c'est
      // l'action (navigation, création de sujet) qui prend le relais.
      setX(0, true);
      right.onAct();
    } else {
      if (!cancelled && !s.moved) onTap?.();
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
        {/* Fond GAUCHE (révélé en glissant à gauche) : libellé à droite. */}
        {left ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-end gap-2 pr-6 text-white",
              TONE_BG[left.tone],
            )}
          >
            <span className="text-[11px] font-bold tracking-[0.3px]">
              {left.label}
            </span>
            <left.icon className="size-[22px]" strokeWidth={2} />
          </div>
        ) : null}
        {/* Fond DROIT (révélé en glissant à droite) : libellé à gauche. */}
        {right ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-start gap-2 pl-6 text-white",
              TONE_BG[right.tone],
            )}
          >
            <right.icon className="size-[22px]" strokeWidth={2} />
            <span className="text-[11px] font-bold tracking-[0.3px]">
              {right.label}
            </span>
          </div>
        ) : null}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => finish(false)}
          onPointerCancel={() => finish(true)}
          className="relative flow-root touch-pan-y bg-white"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
