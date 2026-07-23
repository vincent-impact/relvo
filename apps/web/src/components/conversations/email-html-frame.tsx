"use client";

import { useEffect, useRef, useState } from "react";

// Rendu FIDÈLE d'un e-mail HTML (M6ter+) — dans un iframe ISOLÉ. Un e-mail est du
// HTML hostile : CSS envahissant (styles globaux, !important, largeurs fixes),
// éventuels scripts. L'iframe l'enferme :
//
//   • `sandbox` SANS `allow-scripts` → aucun JS de l'e-mail ne s'exécute (XSS
//     neutralisé, en plus du <script> déjà retiré à l'ingestion) ;
//   • `allow-same-origin` → le document reste de MÊME origine, ce qui permet au
//     PARENT (nous) de mesurer sa hauteur et sa largeur. Sans scripts, cette
//     même origine n'ouvre aucune brèche ;
//   • `allow-popups` → les liens `target="_blank"` s'ouvrent normalement.
//
// ── RESPONSIVE, avec scroll horizontal en DERNIER RECOURS (2026-07-23) ────────
// Le piège : `width=device-width` met en page l'e-mail à la largeur de l'ÉCRAN,
// alors que l'iframe (dans sa bulle) est plus ÉTROIT — d'où ~40 px rognés à
// droite. On fixe donc le viewport à la largeur RÉELLE de l'iframe (`vw`, mesurée
// après montage) : la quasi-totalité des e-mails se mettent en page dans la zone
// visible. Le RESET borne encore les largeurs fixes (`max-width:100%` partout +
// `table-layout:fixed`).
//
// Reste le cas résiduel (rare) d'un e-mail à `min-width` codée en dur, que rien
// ne peut faire rétrécir. Plutôt que de le rogner (illisible), on RÉ-AUTORISE le
// scroll horizontal — mais UNIQUEMENT sur cet e-mail-là : ceux qui tiennent
// n'ont aucun débordement, donc aucune barre. `overscroll-x:contain` empêche le
// geste de « fuir » vers la navigation.

const RESET = `
  html,body{margin:0;padding:0;background:transparent;overflow-x:auto;overscroll-behavior-x:contain;width:100%;-webkit-overflow-scrolling:touch}
  *{max-width:100%!important;box-sizing:border-box}
  body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1128;overflow-wrap:anywhere;word-break:break-word}
  img{height:auto}
  table{table-layout:fixed}
  a{color:#2b6fe0}
`;

export function EmailHtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);
  // Largeur du viewport interne = largeur réelle de l'iframe. Tant qu'inconnue,
  // on n'écrit PAS le document (évite un premier rendu à la mauvaise largeur).
  const [vw, setVw] = useState<number | null>(null);

  const srcDoc =
    vw != null
      ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${vw},initial-scale=1"><base target="_blank"><style>${RESET}</style></head><body>${html}</body></html>`
      : "<!doctype html><html><head></head><body></body></html>";

  // Largeur : mesurée sur l'ÉLÉMENT iframe (dispo même document vide) et suivie
  // au redimensionnement (rotation, resize). Pilote le viewport interne.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const measure = () => {
      const w = iframe.clientWidth;
      if (w > 0) setVw((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(iframe);
    return () => ro.disconnect();
  }, []);

  // Hauteur : suit le contenu (images comprises). Re-mesurée à chaque (re)chargement
  // — dont celui provoqué par un changement de `vw` (nouveau srcDoc).
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
    if (iframe.contentWindow?.document?.readyState === "complete") onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
    };
  }, [vw]);

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
