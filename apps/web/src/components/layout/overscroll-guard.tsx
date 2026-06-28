"use client";

import { useEffect } from "react";

// Garde anti-rebond iOS (rubber-band) — approche « iNoBounce » minimale.
//
// Problème : en PWA standalone iOS, un geste vertical sur une zone NON
// scrollable fait rebondir tout le document (le dock violet remonte avec).
// `overscroll-behavior` et les verrous CSS (position:fixed/overflow:hidden)
// ne corrigent pas ça sans rétrécir le cadre (cf. saga viewport).
//
// Solution : un seul listener `touchmove` NON-passif. On laisse défiler
// normalement DÈS QU'un ancêtre scrollable peut absorber le geste ; sinon on
// `preventDefault()` pour tuer le rebond du document. Zéro impact sur le layout
// → ne peut pas recréer la bande blanche.

function scrollableAncestor(
  start: EventTarget | null,
  root: HTMLElement,
): HTMLElement | null {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== root) {
    const style = getComputedStyle(el);
    const oy = style.overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function OverscrollGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let startX = 0;
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      // Multi-touch (pinch-zoom) : on ne touche à rien.
      if (e.touches.length !== 1) return;

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Geste HORIZONTAL-dominant : le rebond qu'on combat est VERTICAL. On laisse
      // donc passer (sinon, quand la page n'est pas scrollable verticalement, on
      // tuerait le scroll horizontal du semainier — bug PWA après tap sur un jour).
      if (Math.abs(dx) > Math.abs(dy)) return;

      const scroller = scrollableAncestor(e.target, root);

      // Aucun conteneur scrollable sous le doigt → rebond pur du document.
      if (!scroller) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      const atTop = scroller.scrollTop <= 0;
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

      // Geste qui pousserait le conteneur au-delà de sa limite haute/basse :
      // c'est ce dépassement qui se propage en rebond du document → on l'annule.
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
        if (e.cancelable) e.preventDefault();
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
