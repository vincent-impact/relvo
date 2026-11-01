"use client";

import { createPortal } from "react-dom";
import type { EtatDictee } from "@/hooks/use-dictee";
import { formatDuree, PHRASES_DICTEE } from "@/lib/dictee-regles";
import { cn } from "@/lib/utils";

// LE VOILE D'ÉCOUTE (M22.8, recette R10 — retour du dirigeant : « le signal
// d'écoute est à peine perceptible »). Quand on maintient un disque pour parler,
// ce n'est pas le disque qui change : c'est LA PAGE ENTIÈRE qui se met à
// l'écoute. Un voile monte du disque et SOUFFLE, du violet vers le transparent,
// sur le double du souffle des étoiles (`.respire`) ; au milieu, « Relvo
// écoute… » et la durée, dans la pilule noire du produit ; en dessous, le geste
// qui reste à faire. Relâcher : le voile dit que Relvo écoute encore, le temps
// de la transcription, puis l'échange s'ouvre avec le texte.
//
// Pourquoi un voile et pas un changement de page : le doigt est POSÉ sur le
// disque, et c'est lui qui tient l'enregistrement (capture du pointeur). Une
// navigation pendant le maintien démonterait le bouton, perdrait le geste et
// le micro avec lui. Le voile donne l'écran d'écoute sans rien démonter ; la
// page de l'échange vient au relâcher, quand il n'y a plus de geste à tenir.
//
// Un portail vers le corps du document : le disque du dock est transformé à
// l'appui (`scale`), et un élément fixe dans un ancêtre transformé se fixe à
// lui, pas à la fenêtre. Sous le dock (z-10 contre z-20) : le disque qu'on
// tient reste net au-dessus du voile, avec sa pilule. `pointer-events: none` :
// le relâcher arrive au disque, jamais au voile.

export function VoileEcoute({
  etat,
  dureeS,
  dureeMaxS,
}: {
  etat: EtatDictee;
  dureeS: number;
  dureeMaxS: number;
}) {
  if (etat === "repos") return null;
  const enregistre = etat === "enregistre";
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="voile-ecoute pointer-events-none fixed inset-y-0 left-1/2 z-10 w-full max-w-120 -translate-x-1/2 select-none"
    >
      <div className="voile-ecoute-souffle" aria-hidden />
      {/* Une seule pilule noire, lisible sur n'importe quel fond : ce que
          Relvo fait, et le geste qui reste. */}
      <div className="absolute inset-x-0 top-[38%] flex justify-center px-6">
        <div className="flex flex-col items-center rounded-(--rayon-carte) bg-noir px-6 py-3.5 text-white shadow-dock">
          <span className="inline-flex items-center text-[18px] leading-6">
            {PHRASES_DICTEE.ecoute}
            {enregistre ? (
              <span
                className={cn(
                  "chiffre ml-2 text-[19px]",
                  dureeS >= dureeMaxS - 10 && "text-(--attente-texte)",
                )}
              >
                {formatDuree(dureeS)}
              </span>
            ) : (
              <PointsQuiRespirent className="ml-2" />
            )}
          </span>
          <span className="mt-1 text-[13px] leading-4 font-light text-white/70">
            {enregistre ? PHRASES_DICTEE.enregistre : "Un instant"}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Trois points qui respirent — « Relvo travaille » (rédige, écoute). */
export function PointsQuiRespirent({ className }: { className?: string }) {
  return (
    <span
      className={cn("respire inline-flex items-center gap-[3px]", className)}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[4px] rounded-full bg-current" />
      ))}
    </span>
  );
}
