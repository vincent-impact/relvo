"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import { resolveSubjectAction } from "@/server/actions/subjects";

// Slide-to-complete (Direction B) — posé en haut à droite du hero Sujet. Reprend
// le geste de swipe du fil : on glisse le curseur vers la droite ; au-delà du
// seuil, la piste devient verte et le sujet est terminé (resolveSubject). Plus
// compact que deux boutons et fidèle à la gestuelle. Pas de bouton « Ignorer »
// (l'ignore reste un swipe gauche au fil).

const TRACK = 118;
const THUMB = 30;
const PAD = 3;
const MAX = TRACK - THUMB - PAD * 2;

export function SlideToComplete({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const drag = useRef({ active: false, offset: 0 });

  function onDown(e: React.PointerEvent) {
    if (done || pending) return;
    drag.current = { active: true, offset: e.clientX - x };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const nx = Math.max(0, Math.min(MAX, e.clientX - drag.current.offset));
    setX(nx);
  }

  function onUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (x >= MAX * 0.85) {
      setX(MAX);
      setDone(true);
      startTransition(async () => {
        const res = await resolveSubjectAction(subjectId);
        if (res.ok) {
          toast.success("Sujet terminé");
          router.push("/fil");
        } else {
          toast.error(res.message);
          setDone(false);
          setX(0);
        }
      });
    } else {
      setX(0);
    }
  }

  const pct = x / MAX;

  return (
    <div
      className="relative h-[36px] flex-none overflow-hidden rounded-full"
      style={{
        width: TRACK,
        background: "rgb(255 255 255 / 0.16)",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.28)",
      }}
    >
      {/* remplissage vert, suit le curseur */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-(--green-600)"
        style={{
          width: x + THUMB + PAD * 2,
          opacity: done ? 1 : 0.3 + pct * 0.7,
          transition: drag.current.active
            ? "none"
            : "width .2s ease, opacity .2s ease",
        }}
      />
      {/* libellé, s'efface quand on glisse */}
      <span
        className="pointer-events-none absolute inset-0 grid place-items-center pr-3 pl-9 text-[12.5px] font-bold text-white"
        style={{ opacity: 1 - pct }}
      >
        Terminer
      </span>
      {/* curseur */}
      <button
        type="button"
        aria-label="Glisser pour terminer le sujet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute top-1/2 grid size-[30px] touch-none place-items-center rounded-full bg-white text-(--green-600)"
        style={{
          transform: `translate(${x + PAD}px, -50%)`,
          transition: drag.current.active ? "none" : "transform .2s ease",
          boxShadow: "0 2px 6px rgb(0 0 0 / 0.2)",
        }}
      >
        {done ? (
          <Check className="size-4" strokeWidth={2.6} />
        ) : (
          <ChevronsRight className="size-4" strokeWidth={2.6} />
        )}
      </button>
    </div>
  );
}
