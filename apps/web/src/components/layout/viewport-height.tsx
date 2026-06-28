"use client";

import { useEffect } from "react";

// Hauteur de cadre FIABLE en PWA standalone iOS — corrige le bug récurrent où le
// cadre se réduit de quelques pixels au lancement (footer surélevé, bande blanche
// dessous), récupérable seulement par un relog / une rotation / un pinch (= tous
// des recalculs de viewport).
//
// CAUSE : au lancement à froid, iOS rapporte `window.innerHeight` (et `100dvh`)
// trop COURT de quelques px — il n'inclut la safe-area basse qu'après un premier
// recalcul de viewport. En revanche `documentElement.clientHeight` (la boîte de
// <html height:100%> = l'ICB) rapporte souvent déjà la BONNE hauteur pleine.
//
// FIX : on pose `--app-height = MAX(innerHeight, clientHeight, visualViewport,
// screen.height)` → la métrique correcte (la plus grande) l'emporte dès le 1er
// paint, sans attendre d'interaction. `window.screen.height` est STABLE dès le
// lancement (≠ innerHeight) et, l'app étant verrouillée en PORTRAIT, vaut la
// pleine hauteur d'écran — on ne l'ajoute QUE en portrait pour ne jamais sur-
// dimensionner si iOS bascule quand même en paysage. Le `max` protège aussi du
// clavier iOS (qui rétrécit `visualViewport.height` mais pas `innerHeight`) → le
// cadre reste plein. On re-mesure sur resize / rotation / retour au 1er plan +
// plusieurs timers. `MobileFrame` lit `var(--app-height, 100dvh)`.
export function ViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    // `screen.height` n'est pertinent QU'EN PWA standalone (où la webview occupe
    // tout l'écran) — sinon, dans un onglet navigateur étroit (fenêtre « portrait »
    // mais plus courte que l'écran), il sur-dimensionnerait le cadre.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const portrait = window.innerHeight >= window.innerWidth;
        const h = Math.round(
          Math.max(
            window.innerHeight,
            document.documentElement.clientHeight,
            window.visualViewport?.height ?? 0,
            standalone && portrait ? window.screen.height : 0,
          ),
        );
        if (h > 0) root.style.setProperty("--app-height", `${h}px`);
      });
    };

    apply();
    // Le viewport standalone iOS se cale quelques dizaines/centaines de ms après
    // le 1er paint → on re-mesure pour écraser une éventuelle valeur de lancement.
    const timers = [100, 350, 800, 1500].map((d) =>
      window.setTimeout(apply, d),
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };

    window.addEventListener("load", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("pageshow", apply);
    document.addEventListener("visibilitychange", onVisible);
    window.visualViewport?.addEventListener("resize", apply);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("load", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("pageshow", apply);
      document.removeEventListener("visibilitychange", onVisible);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
