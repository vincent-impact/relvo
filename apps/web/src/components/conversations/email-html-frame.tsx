"use client";

import { useEffect, useRef, useState } from "react";

// Rendu FIDÈLE d'un e-mail HTML (M6ter+) — dans un iframe ISOLÉ. Un e-mail est du
// HTML hostile : CSS envahissant (styles globaux, !important, largeurs fixes),
// éventuels scripts. L'iframe l'enferme :
//
//   • `sandbox` SANS `allow-scripts` → aucun JS de l'e-mail ne s'exécute (XSS
//     neutralisé, en plus du <script> déjà retiré à l'ingestion) ;
//   • `allow-same-origin` → le document reste de MÊME origine, ce qui permet au
//     PARENT (nous) de mesurer sa hauteur pour auto-dimensionner l'iframe. Sans
//     scripts, cette même origine n'ouvre aucune brèche ;
//   • `allow-popups` → les liens `target="_blank"` s'ouvrent normalement.
//
// La hauteur suit le contenu, images comprises (ResizeObserver sur le body, qui
// grandit quand les images finissent de charger).

// Aucun SCROLL HORIZONTAL possible (exigence mobile) : on borne tout à la
// largeur de la bulle. `overflow-x:hidden` supprime la barre ; `max-width:100%`
// sur *tout* (images, tableaux à largeur fixe façon newsletters, <pre>…) empêche
// le moindre débordement ; `box-sizing:border-box` évite qu'un padding pousse
// au-delà. `table-layout:fixed` force les colonnes à se répartir dans la largeur
// disponible plutôt que d'imposer leurs largeurs codées en dur.
const RESET = `
  html,body{margin:0;padding:0;background:transparent;overflow-x:hidden;width:100%}
  *{max-width:100%!important;box-sizing:border-box}
  body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1128;overflow-wrap:anywhere;word-break:break-word}
  img{height:auto}
  table{table-layout:fixed}
  a{color:#2b6fe0}
`;

export function EmailHtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>${RESET}</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
      );
      if (h > 0) setHeight(h);
    };

    const onLoad = () => {
      measure();
      const body = iframe.contentWindow?.document?.body;
      if (body && "ResizeObserver" in window) {
        ro = new ResizeObserver(() => measure());
        ro.observe(body);
      }
    };

    iframe.addEventListener("load", onLoad);
    // Le srcDoc peut déjà être chargé au moment où l'effet tourne.
    if (iframe.contentWindow?.document?.readyState === "complete") onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={ref}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title="Message"
      loading="lazy"
      className="w-full border-0"
      style={{ height }}
    />
  );
}
