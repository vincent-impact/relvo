"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  closeSubjectAction,
  validateSubjectAction,
} from "@/server/actions/subjects";
import { ignoreConversationAction } from "@/server/actions/conversations";
import { cn } from "@/lib/utils";

// Carte-sujet swipable (approche retenue, cf. mockup/mobile/fil.html) :
//  - glisser → DROITE = Valider (fond vert, libellé à gauche)
//  - glisser ← GAUCHE = Fermer (fond rouge, libellé à droite ; off si non fermable)
//  - tap (sans glissé) = ouvrir la fiche du sujet
// Gestuelle en pointer-events (aucun primitive shadcn). Fonds PLEINE LARGEUR
// (inset-0) pour qu'un glissé ample ne révèle jamais le bord d'une colonne.
// Au lâcher validé : retrait optimiste (collapse) → pas de ligne rémanente, puis
// la Server Action revalide /fil (+ router.refresh) pour la vérité serveur.

const THRESHOLD = 80;

export function SwipeableSubject({
  subjectId,
  canClose,
  rounded = true,
  children,
}: {
  subjectId: string;
  canClose: boolean;
  /** false : ligne pleine largeur (SubjectRow) sans coins arrondis. */
  rounded?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const [dir, setDir] = useState(0); // -1 fermer · 0 repos · 1 valider
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

  /** Annule le retrait optimiste et remet la carte en place (échec serveur). */
  function rollback(message: string) {
    toast.error(message);
    setLeaving(false);
    setDir(0);
    setX(0, true);
  }

  function commitValidate() {
    setLeaving(true); // retrait optimiste immédiat (collapse)
    startTransition(async () => {
      const res = await validateSubjectAction(subjectId);
      if (!res.ok) return rollback(res.message);
      toast.success("Sujet validé");
      router.refresh();
    });
  }

  /**
   * Fermeture (cas Q) — puis PROPOSITION d'ignorer la conversation.
   *
   * Fermer un sujet referme une fenêtre ; ça ne fait pas taire la source. Or le
   * vrai besoin derrière « ce sujet me pollue » est souvent d'ignorer le fil
   * (le « groupe WhatsApp bavard »). D'où l'enchaînement — mais NON BLOQUANT :
   * un toast avec action plutôt qu'un Dialog, parce que le geste d'origine est
   * un swipe, c'est-à-dire un geste de balayage rapide qu'une modale
   * interromprait à chaque fois. Ne rien faire vaut « non » (la conversation
   * reste active) : refuser ne coûte aucun clic, accepter en coûte un.
   */
  function commitClose() {
    setLeaving(true);
    startTransition(async () => {
      const res = await closeSubjectAction(subjectId);
      if (!res.ok) return rollback(res.message);
      router.refresh();

      const ignorable = res.data.ignorable;
      if (ignorable.length === 0) {
        // Aucune conversation encore active : rien à proposer (sujet créé à la
        // main, ou fil déjà ignoré) — on ne pose pas une question sans objet.
        toast.success("Sujet fermé");
        return;
      }
      const plural = ignorable.length > 1;
      toast.success("Sujet fermé", {
        description: `Souhaitez-vous aussi ignorer ${plural ? "ces conversations" : "la conversation"} ?`,
        duration: 10000,
        action: {
          label: plural ? "Ignorer les fils" : "Ignorer le fil",
          onClick: () => {
            startTransition(async () => {
              // Le sujet pouvait porter plusieurs conversations : on les fait
              // toutes taire d'un coup, puisque la question était posée pour
              // l'ensemble de la fenêtre qu'on vient de refermer.
              const results = await Promise.all(
                ignorable.map((c) => ignoreConversationAction(c.id)),
              );
              const failed = results.find((r) => !r.ok);
              if (failed && !failed.ok) {
                toast.error(failed.message);
                return;
              }
              toast.success(
                plural ? "Conversations ignorées" : "Conversation ignorée",
              );
              router.refresh();
            });
          },
        },
      });
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
      if (!canClose && dx < 0) dx = 0; // non fermable : pas de fermeture
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
      commitValidate();
    } else if (canClose && s.horiz && s.dx < -THRESHOLD) {
      setX(-window.innerWidth, true);
      commitClose();
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
      <div className={cn("relative overflow-hidden", rounded && "rounded-xl")}>
        {/* Fond Valider (vert) : révélé en glissant à droite, libellé à gauche. */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-start gap-2 bg-(--green-600) pl-6 text-white",
            dir < 0 && "hidden",
          )}
        >
          <Check className="size-[22px]" strokeWidth={2.4} />
          <span className="text-[11px] font-bold tracking-[0.3px]">
            Valider
          </span>
        </div>
        {/* Fond Fermer (rouge) : révélé en glissant à gauche, libellé à droite. */}
        {canClose ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-end gap-2 bg-brand-accent pr-6 text-white",
              dir >= 0 && "hidden",
            )}
          >
            <span className="text-[11px] font-bold tracking-[0.3px]">
              Fermer
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
          className="relative flow-root cursor-pointer touch-pan-y bg-white"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
