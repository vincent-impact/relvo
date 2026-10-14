"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@/components/shared/picto";
import { toast } from "sonner";
import {
  dismissResolutionAction,
  validateSubjectAction,
} from "@/server/actions/subjects";

// Bandeau de RÉSOLUTION — la seule action de statut que porte la fiche, et elle
// n'y est que parce que Relvo l'a proposée (`resolutionSuggestedAt`).
//
// Pourquoi il ne contredit PAS la décision de 2026-09-07 (« aucun dock d'action
// sur la fiche ») : ce n'est pas un dock. Un dock est permanent et double les
// swipes de la page Sujets ; ce bandeau est RARE — il n'apparaît que quand
// l'agent a quelque chose à conclure — et il évite l'aller-retour absurde qui
// consistait à revenir sur la liste pour swiper un sujet qu'on vient de lire.
// « La rareté est le signal » : parce qu'il est rare, il est fort.
//
// Sans lui, la fiche d'un sujet dont tout est fait est un cul-de-sac : elle
// affiche des tâches barrées et ne propose aucune suite.
//
// « Pas encore » retire la suggestion (le sujet reste ouvert) plutôt que de la
// masquer localement : masquée, elle reviendrait au prochain chargement.

export function ResolutionBanner({
  subjectId,
  reference,
}: {
  subjectId: string;
  /** Référence du sujet — nommée dans les messages de confirmation. */
  reference: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function validate() {
    startTransition(async () => {
      const res = await validateSubjectAction(subjectId);
      if (res.ok) {
        toast.success(`${reference} validé`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      const res = await dismissResolutionAction(subjectId);
      if (res.ok) router.refresh();
      else toast.error(res.message);
    });
  }

  return (
    <section
      aria-label="Suggestion de Relvo"
      className="flex gap-3 rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale px-4 py-3.5 shadow-carte"
    >
      <span className="grid size-[30px] flex-none place-items-center self-start rounded-full bg-relvo text-white">
        <Sparkle className="size-[15px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="text-[14px] leading-5 font-light text-noir">
          Les tâches sont faites et rien n’est arrivé depuis.{" "}
          <span className="text-gris">Ce sujet est-il réglé ?</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={validate}
            className="pressable inline-flex h-[34px] items-center rounded-(--rayon-pilule) px-4 text-[13px] font-medium text-white disabled:opacity-60"
            style={{ background: "var(--degrade-relvo)" }}
          >
            Valider le sujet
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={dismiss}
            className="pressable inline-flex h-[34px] items-center rounded-(--rayon-pilule) border border-(--filet) bg-white px-4 text-[13px] font-medium text-gris disabled:opacity-60"
          >
            Pas encore
          </button>
        </div>
      </div>
    </section>
  );
}
