"use client";

import { useRef, useState, useTransition } from "react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RELVO_LOGO_PATHS, RelvoLogo } from "@/components/layout/relvo-logo";
import { EtapeFormulaire } from "@/components/relvo-chat/etape-formulaire";
import { MAIL_CHOICES } from "@/components/settings/connect-email-button";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import {
  connecterPremiereBoiteAction,
  passerBienvenueAction,
} from "@/server/actions/bienvenue";
import type { MailProvider } from "@/server/unipile/client";
import { cn } from "@/lib/utils";

// Les diapositives de première connexion (01 §11, M19.9) : un ciel plein
// écran, cinq phrases courtes qui disent la promesse — ce que Relvo fera du
// courrier —, puis l'invitation à connecter sa première adresse, posée en
// ÉTAPE-FORMULAIRE dans la voix de Relvo. Du contexte, pas un mode d'emploi :
// aucune diapositive n'explique un écran ; ce qui s'apprend (sujet, domaine,
// tâche) s'apprend dans l'échange.
//
// Le glissé est natif (`scroll-snap`), pas une bibliothèque : le pouce fait ce
// qu'il fait partout ailleurs sur le téléphone, et le geste s'interrompt. Les
// illustrations sont des MORCEAUX DU PRODUIT, rendus avec sa matière — une
// ligne de sujet, un bloc de Relvo, le disque — jamais une image. C'est la
// seule surface qui a droit à la durée d'ACCOMPAGNEMENT (01-tokens, « Le
// mouvement ») : l'illustration de la diapositive courante se pose quand on y
// arrive, une fois.
//
// « Passer » mène à la dernière diapositive, pas hors de la séquence :
// l'invitation est le but, les diapositives n'en sont que le chemin. « Plus
// tard » en sort — la trace est posée, on ne les remontre jamais.

type Slide = {
  key: string;
  title: React.ReactNode;
  text: string;
  Illustration: React.ComponentType;
};

function Signe() {
  return <RelvoLogo size={96} variant="mark" className="text-white" />;
}

// Une ligne de sujet, telle que la liste la rend : la bande, le domaine, le
// titre, et une tâche en dessous.
function Sujet() {
  return (
    <div className="flex w-[264px] overflow-hidden rounded-(--rayon-carte) bg-white text-left text-noir shadow-carte">
      <i aria-hidden className="bande-carte bg-(--domaine-orange)" />
      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="domaine text-(--domaine-orange-texte)">
          Fournisseurs
        </div>
        <div className="mt-1 text-[15px] leading-5 font-normal">
          Devis chambre froide
        </div>
        <div className="mt-0.5 text-[12px] leading-4 font-normal text-gris">
          Karim Benali · 3 messages
        </div>
        <div className="mt-2.5 flex items-center gap-2.5 border-t border-(--filet) pt-2.5">
          <i
            aria-hidden
            className="grid size-[22px] flex-none place-items-center rounded-full border-2 border-(--gris-clair)"
          />
          <span className="min-w-0 flex-1 truncate text-[14px] font-normal">
            Valider le devis
          </span>
          <span className="chiffre text-[15px] text-noir">jeu.</span>
        </div>
      </div>
    </div>
  );
}

// Le bloc des nouvelles, tel que l'accueil le rend.
function Brief() {
  return (
    <RelvoBlock className="w-[280px] text-left">
      <RelvoSentence>
        Depuis votre dernière visite, j’ai lu 12 messages et ouvert 2 sujets.
      </RelvoSentence>
      <span className="mt-0.5 block py-1.5 pl-[1.1em] -indent-[1.1em] text-[14px] leading-[18px] font-medium text-relvo">
        → Le devis de la chambre froide attend votre décision.
      </span>
    </RelvoBlock>
  );
}

// Un brouillon prêt, tel que la conversation le pose.
function Brouillon() {
  return (
    <div className="w-[280px] rounded-(--rayon-carte) bg-white px-3.5 py-3 text-left text-noir shadow-carte">
      <div className="libelle">Brouillon de Relvo</div>
      <p className="mt-1.5 text-[14px] leading-5 font-light">
        Bonjour Karim, nous validons le devis pour une pose le 24. Pouvez-vous
        confirmer le créneau du matin ?
      </p>
      <span
        className="mt-2.5 inline-flex h-9 items-center rounded-(--rayon-pilule) px-4 text-[13px] font-medium text-white"
        style={{ background: "var(--degrade-relvo)" }}
      >
        Relire et envoyer
      </span>
    </div>
  );
}

// Le dock et son disque, tels que l'application les porte — en statique.
function Disque() {
  return (
    <div className="relative flex h-[54px] w-[240px] items-center justify-center rounded-(--rayon-dock) bg-noir shadow-dock">
      <span
        className="grid size-(--disque-relvo) place-items-center rounded-full text-white"
        style={{ background: "var(--degrade-disque)" }}
      >
        <svg viewBox="116 104 296 296" width="30" height="30" aria-hidden>
          <g fill="currentColor">
            {RELVO_LOGO_PATHS.stars.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
      </span>
      {[18, 62, 178, 222].map((x) => (
        <i
          key={x}
          aria-hidden
          className="absolute top-1/2 size-5 -translate-y-1/2 rounded-[5px] bg-white/25"
          style={{ left: x - 10 }}
        />
      ))}
    </div>
  );
}

const PLUS_TARD = "PLUS_TARD" as const;
type Choix = MailProvider | typeof PLUS_TARD;

export function Diapositives({ firstName }: { firstName: string }) {
  const slides: Slide[] = [
    {
      key: "signe",
      title: <>Bonjour {firstName}.</>,
      text: "Je suis Relvo. Je lis le courrier que vous recevez, et j’en fais des sujets.",
      Illustration: Signe,
    },
    {
      key: "sujet",
      title: "Chaque affaire devient un sujet.",
      text: "Un devis, une relance, un litige : ses messages, ses tâches et son journal, au même endroit.",
      Illustration: Sujet,
    },
    {
      key: "brief",
      title: "Je vous dis ce qui attend.",
      text: "Dès que vous ouvrez l’application : ce qui attend une réponse, une décision, et ce que j’ai fait de mon côté.",
      Illustration: Brief,
    },
    {
      key: "brouillon",
      title: "Je prépare vos réponses.",
      text: "Vous relisez, vous envoyez. Rien ne part sans vous.",
      Illustration: Brouillon,
    },
    {
      key: "disque",
      title: "Le disque au centre, c’est moi.",
      text: "Posez-moi une question depuis n’importe quelle page.",
      Illustration: Disque,
    },
  ];
  const total = slides.length + 1;
  const last = total - 1;

  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Choix | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: i * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  function onScroll() {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  }

  function choose(choix: Choix) {
    setError(null);
    setBusy(choix);
    startTransition(async () => {
      if (choix === PLUS_TARD) {
        await passerBienvenueAction();
        // Navigation complète, pas `router` : voir l'action.
        window.location.replace("/");
        return;
      }
      const result = await connecterPremiereBoiteAction(choix);
      if (result.ok) {
        window.location.href = result.data.url;
        return;
      }
      setError(result.message);
      setBusy(null);
    });
  }

  return (
    <MobileFrame
      className="ciel entre-ecran"
      style={{ background: "var(--ciel-plein)" }}
    >
      {/* La rangée du haut : rien à gauche, « Passer » à droite, sous la
          barre d'état. Sur la dernière diapositive, il n'y a plus rien à passer. */}
      <div
        className="flex h-[58px] flex-none items-center justify-end px-4"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px))",
        }}
      >
        <button
          type="button"
          onClick={() => goTo(last)}
          className={cn(
            "h-11 px-2 text-[14px] font-medium text-white/85 transition-opacity active:opacity-70",
            index === last && "pointer-events-none opacity-0",
          )}
          aria-hidden={index === last}
          tabIndex={index === last ? -1 : 0}
        >
          Passer
        </button>
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        aria-roledescription="diapositives"
      >
        {slides.map((s, i) => (
          <section
            key={s.key}
            aria-label={`${i + 1} sur ${total}`}
            className="flex w-full flex-none snap-start flex-col px-6"
          >
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {/* L'illustration se pose quand sa diapositive devient courante :
                  la classe est posée à ce moment-là, l'animation part une fois. */}
              <div className={cn(index === i && "arrive")}>
                <s.Illustration />
              </div>
            </div>
            <div className="flex-none pb-6">
              <h2 className="font-heading text-[30px] leading-9 font-semibold tracking-[-0.01em] text-white">
                {s.title}
              </h2>
              <p className="mt-2 text-[16px] leading-[22px] font-light text-white/90">
                {s.text}
              </p>
            </div>
          </section>
        ))}

        {/* L'invitation : une étape-formulaire de Relvo. Les trois boîtes sont
            celles de la page des canaux — même liste, même action. */}
        <section
          aria-label={`${total} sur ${total}`}
          className="flex w-full flex-none snap-start flex-col justify-end px-4 pb-4"
        >
          <h2 className="px-2 font-heading text-[30px] leading-9 font-semibold tracking-[-0.01em] text-white">
            Par où on commence ?
          </h2>
          <RelvoBlock className={cn("mt-4", index === last && "arrive")}>
            <EtapeFormulaire<Choix>
              question="Confiez-moi la boîte où arrivent vos fournisseurs et vos clients : je lis le courrier des dernières semaines et j’ouvre les premiers sujets."
              options={[
                ...MAIL_CHOICES.map((c) => ({
                  key: c.provider,
                  label: c.label,
                  hint: c.hint,
                })),
                { key: PLUS_TARD, label: "Plus tard", secondary: true },
              ]}
              onChoose={choose}
              busyKey={busy}
              disabled={pending}
              error={error}
            />
          </RelvoBlock>
        </section>
      </div>

      {/* Les points et « Continuer » : absents sur la dernière diapositive, où
          le formulaire est le geste. */}
      <div
        className={cn(
          "flex-none px-6 pt-2 transition-opacity",
          index === last && "pointer-events-none opacity-0",
        )}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        aria-hidden={index === last}
      >
        <div className="flex items-center justify-center gap-2 py-3">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              aria-hidden
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === index ? "bg-white" : "bg-white/35",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          tabIndex={index === last ? -1 : 0}
          className="pressable flex h-12 w-full items-center justify-center rounded-(--rayon-pilule) bg-white text-[15px] font-medium text-relvo shadow-carte"
        >
          Continuer
        </button>
      </div>
    </MobileFrame>
  );
}
