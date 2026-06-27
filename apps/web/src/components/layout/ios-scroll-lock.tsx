"use client";

import { useEffect } from "react";

// Verrou anti rubber-band iOS (approche iNoBounce, cf. recherche 2026-06-27).
// Sur iOS standalone, `overscroll-behavior` ne bloque PAS le rebond élastique du
// DOCUMENT, et verrouiller le body en CSS (overflow:hidden / position:fixed)
// rétrécit le cadre → bande blanche sous le dock. On neutralise donc le rebond
// en JS, SANS toucher au layout :
//   - geste horizontal (carrousels, swipe) → on laisse passer ;
//   - geste vertical DANS un conteneur scrollable non arrivé en butée → on laisse
//     défiler ;
//   - sinon (hors scroller, ou scroller en butée) → preventDefault : pas de
//     rebond, donc le dock ne bouge plus.

export function IosScrollLock() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    // Remonte au plus proche ancêtre réellement défilable verticalement.
    function scrollableAncestor(
      target: EventTarget | null,
    ): HTMLElement | null {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== document.body) {
        const oy = getComputedStyle(node).overflowY;
        if (
          (oy === "auto" || oy === "scroll") &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0]!.clientX - startX;
      const dy = e.touches[0]!.clientY - startY;

      // Geste plutôt horizontal → ne pas interférer (carrousels, swipe-actions).
      if (Math.abs(dx) >= Math.abs(dy)) return;

      const scroller = scrollableAncestor(e.target);
      if (!scroller) {
        e.preventDefault(); // zone non scrollable → pas de rebond du document
        return;
      }

      const atTop = scroller.scrollTop <= 0;
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      // En butée et on tire encore dans le vide → bloque le rebond.
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
    };
  }, []);

  return null;
}
