"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  ignoreSubjectAction,
  resolveSubjectAction,
} from "@/server/actions/subjects";
import { cn } from "@/lib/utils";

// Carte-sujet swipable (approche retenue, cf. mockup/mobile/fil.html) :
//  - glisser → DROITE = Terminer (fond vert, libellé à gauche)
//  - glisser ← GAUCHE = Ignorer (fond rouge, libellé à droite ; off si déjà low)
//  - tap (sans glissé) = ouvrir la fiche du sujet
// Gestuelle en pointer-events (aucun primitive shadcn). Fonds PLEINE LARGEUR
// (inset-0) pour qu'un glissé ample ne révèle jamais le bord d'une colonne.
// Au lâcher validé : retrait optimiste (collapse) → pas de ligne rémanente, puis
// la Server Action revalide /fil (+ router.refresh) pour la vérité serveur.

const THRESHOLD = 80;

export function SwipeableSubject({
  subjectId,
  canIgnore,
  children,
}: {
  subjectId: string;
  canIgnore: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const [dir, setDir] = useState(0); // -1 ignorer · 0 repos · 1 terminer
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

  function commit(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    okMsg: string,
  ) {
    setLeaving(true); // retrait optimiste immédiat (collapse)
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.message);
        setLeaving(false);
        setDir(0);
        setX(0, true);
      }
    });
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
    setX(0);
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
      let dx = mx;
      if (!canIgnore && dx < 0) dx = 0; // low : pas d'ignorer
      s.dx = dx;
      const nextDir = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      if (nextDir !== dir) setDir(nextDir);
      setX(dx);
    }
  }

  function onPointerEnd() {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    if (s.horiz && s.dx > THRESHOLD) {
      setX(window.innerWidth, true);
      commit(() => resolveSubjectAction(subjectId), "Sujet terminé");
    } else if (canIgnore && s.horiz && s.dx < -THRESHOLD) {
      setX(-window.innerWidth, true);
      commit(() => ignoreSubjectAction(subjectId), "Sujet ignoré");
    } else {
      setDir(0);
      setX(0, true);
    }
  }

  function onClick(e: React.MouseEvent) {
    if (g.current.moved) {
      g.current.moved = false;
      e.preventDefault();
      return;
    }
    router.push(`/sujets/${subjectId}`);
  }

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300",
        leaving ? "max-h-0 opacity-0" : "max-h-[600px]",
      )}
    >
      <div className="relative overflow-hidden rounded-xl">
        {/* Fond Terminer (vert) : révélé en glissant à droite, libellé à gauche. */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-start gap-2 bg-(--green-600) pl-6 text-white",
            dir < 0 && "hidden",
          )}
        >
          <Check className="size-[22px]" strokeWidth={2.4} />
          <span className="text-[11px] font-bold tracking-[0.3px]">
            Terminer
          </span>
        </div>
        {/* Fond Ignorer (rouge) : révélé en glissant à gauche, libellé à droite. */}
        {canIgnore ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-end gap-2 bg-brand-accent pr-6 text-white",
              dir >= 0 && "hidden",
            )}
          >
            <span className="text-[11px] font-bold tracking-[0.3px]">
              Ignorer
            </span>
            <EyeOff className="size-[22px]" strokeWidth={2} />
          </div>
        ) : null}

        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onClick}
          className="relative cursor-pointer touch-pan-y bg-white"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
