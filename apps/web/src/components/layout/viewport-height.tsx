"use client";

import { useEffect } from "react";

// Hauteur de cadre FIABLE en PWA standalone iOS — corrige le bug récurrent où
// `100dvh` est mal mesuré au lancement à froid / après un déploiement (le cadre
// se réduit, bande blanche sous le dock, et il fallait se déconnecter/reconnecter
// pour récupérer la bonne taille).
//
// Principe : on pose `--app-height = window.innerHeight` (la hauteur du viewport
// de MISE EN PAGE — stable, NON affectée par le clavier iOS, contrairement à
// `visualViewport.height`) et on RE-MESURE sur tous les moments où iOS peut avoir
// donné une valeur transitoire fausse : resize, rotation, retour au premier plan
// (`pageshow`/`visibilitychange`) + deux re-mesures différées après le lancement,
// le temps que le viewport standalone se stabilise. `MobileFrame` lit
// `var(--app-height, 100dvh)` → `100dvh` reste le repli SSR/navigateur.
export function ViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty("--app-height", `${window.innerHeight}px`);
      });
    };

    apply();
    // Le viewport standalone iOS se cale quelques dizaines/centaines de ms après
    // le 1er paint → on re-mesure pour écraser une éventuelle valeur de lancement.
    const t1 = window.setTimeout(apply, 120);
    const t2 = window.setTimeout(apply, 500);

    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };

    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("pageshow", apply);
    document.addEventListener("visibilitychange", onVisible);
    window.visualViewport?.addEventListener("resize", apply);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("pageshow", apply);
      document.removeEventListener("visibilitychange", onVisible);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
