"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import {
  pointDeChute,
  VoileEcoute,
  type PointDeChute,
} from "@/components/shared/voile-ecoute";
import { useDictee } from "@/hooks/use-dictee";
import { SEUIL_MAINTIEN_MS, urlEchangeDicte } from "@/lib/echanges-regles";
import { cn } from "@/lib/utils";

// Le bouton Relvo — centre du dock, SEUL objet coloré du dock (design-system/
// 01-tokens, « Le bouton Relvo »). Un disque plat en dégradé de violet, les
// étoiles blanches, plus grand que la pilule : il en déborde en haut et en bas,
// dans son axe, et la pilule se SOULÈVE autour de lui en courbe douce, comme un
// tissu tendu (DockFabric, bottom-tab-bar) — il est DANS la barre, pas posé
// dessus. Ce qui le désigne, c'est la couleur, pas un relief ni une ombre. Sa
// matière vit ICI et nulle part ailleurs — si un second objet du dock se colore
// ou se met à briller, on perd « ce qui se détache, c'est Relvo ».
//
// Le badge porte le nombre de questions de Relvo en attente (`RelvoQuestion`,
// invariant 36), compté par le layout de l'application (M18.9, livré par M10).
// Il est repoussé hors du bord pour ne jamais masquer les petites étoiles.
//
// Page-aware (invariant 26) : le bouton ouvre l'échange plein écran en
// transmettant la page d'origine (`?from=`) pour le chip de contexte, les
// prompts et le retour.
//
// Deux gestes (M22.8, recette R10). Le TAP ouvre l'échange comme toujours. Le
// MAINTIEN parle : passé le seuil, le micro s'ouvre — le même crochet que le
// disque du composer, la même route —, le téléphone vibre, et LA PAGE ENTIÈRE
// se met à l'écoute (`VoileEcoute` : le voile qui souffle depuis le disque,
// « Relvo écoute… » et la durée au milieu de l'écran) ; RELÂCHER envoie, et
// l'échange s'ouvre sur un NOUVEL échange avec la dictée déjà posée en premier
// tour. Un maintien trop court, un micro refusé : la phrase du crochet, en
// toast, et rien d'autre ne bouge. Sans micro sur l'appareil, le disque n'est
// qu'un bouton. Le badge ne change pas.
//
// Quand Relvo LIT le courrier (rattrapage en cours), les étoiles RESPIRENT
// (`.respire`, le seul mouvement qui dit « Relvo travaille ») : le travail se
// voit d'où qu'on soit, sans ouvrir la page des canaux. Le disque, lui, ne
// change pas — c'est sa couleur qui le désigne, pas un mouvement.

export function RelvoDockButton({
  pending = 0,
  reading = false,
  className,
}: {
  /** Questions de Relvo en attente d'une réponse — 0 = pas de badge. */
  pending?: number;
  /** Relvo lit le courrier en ce moment : les étoiles respirent. */
  reading?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const href = `/relvo?from=${encodeURIComponent(pathname)}`;

  const d = useDictee({
    onTexte: (texte) => {
      const url = urlEchangeDicte(texte, pathname);
      if (url) router.push(url);
    },
  });
  const enregistre = d.etat === "enregistre";
  const ecoute = d.etat === "transcrit";

  // Le point de chute des ondes : le centre du disque, mesuré à l'ouverture
  // du micro — le dock bouge avec la zone sûre et la largeur de l'écran.
  const disque = useRef<HTMLButtonElement>(null);
  const [origine, setOrigine] = useState<PointDeChute | null>(null);
  useEffect(() => {
    if (enregistre) setOrigine(pointDeChute(disque.current));
  }, [enregistre]);

  // Ce que la dictée a à dire hors enregistrement — « Maintenez pour parler »,
  // le micro refusé, le réseau — passe en toast : le dock n'a pas de bandeau.
  const { phrase, etat, effacerPhrase } = d;
  useEffect(() => {
    if (etat !== "repos" || !phrase) return;
    toast(phrase);
    effacerPhrase();
  }, [etat, phrase, effacerPhrase]);

  // Le seuil entre le tap et le maintien : un minuteur posé à l'appui.
  const minuteur = useRef<number | null>(null);
  const maintenu = useRef(false);
  useEffect(
    () => () => {
      if (minuteur.current) window.clearTimeout(minuteur.current);
    },
    [],
  );

  function appui(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    maintenu.current = false;
    if (!d.disponible || !d.pret || ecoute) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    minuteur.current = window.setTimeout(() => {
      minuteur.current = null;
      maintenu.current = true;
      void d.appuyer();
    }, SEUIL_MAINTIEN_MS);
  }
  function fin(annule: boolean) {
    if (minuteur.current) {
      window.clearTimeout(minuteur.current);
      minuteur.current = null;
    }
    if (maintenu.current) {
      d.relacher();
      return;
    }
    if (!annule && !ecoute) router.push(href);
  }

  const label = [
    pending > 0
      ? `Parler à Relvo, ${pending} question${pending > 1 ? "s" : ""} en attente`
      : "Parler à Relvo",
    d.disponible ? "maintenir pour dicter" : null,
    reading ? "Relvo lit votre courrier" : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <button
      ref={disque}
      type="button"
      onPointerDown={appui}
      onPointerUp={() => fin(false)}
      onPointerCancel={() => fin(true)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      aria-label={enregistre ? "Relâchez pour envoyer" : label}
      aria-busy={ecoute || undefined}
      className={cn(
        "relative grid size-(--disque-relvo) flex-none place-items-center rounded-full text-white transition-transform duration-(--dur-presse) select-none [-webkit-touch-callout:none] active:translate-y-px active:scale-[0.97]",
        "touch-none",
        enregistre && "scale-110 active:scale-110",
        className,
      )}
      style={{ background: "var(--degrade-disque)" }}
    >
      <svg viewBox="116 104 296 296" width="30" height="30" aria-hidden="true">
        <g
          fill="currentColor"
          className={cn((reading || enregistre || ecoute) && "respire")}
        >
          {RELVO_LOGO_PATHS.stars.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      {pending > 0 ? (
        <span className="chiffre absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-noir bg-urgent px-1 text-[10px] text-white">
          {pending}
        </span>
      ) : null}
      {/* L'écoute se dit sur toute la page, pas au-dessus du disque. */}
      <VoileEcoute
        etat={d.etat}
        dureeS={d.dureeS}
        dureeMaxS={d.dureeMaxS}
        origine={origine}
      />
    </button>
  );
}
