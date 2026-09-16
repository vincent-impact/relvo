"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
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
      className="flex gap-3 rounded-[14px] border border-l-[3px] border-(--purple-100) border-l-relvo bg-white px-4 py-3.5 shadow-surface-1"
    >
      <span className="grid size-[30px] flex-none place-items-center self-start rounded-full bg-relvo text-white">
        <Sparkles className="size-[15px]" fill="currentColor" strokeWidth={0} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="text-[14px] leading-[1.4] text-(--text-primary)">
          Les tâches sont faites et rien n’est arrivé depuis.{" "}
          <span className="text-(--text-secondary)">
            Ce sujet est-il réglé ?
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={validate}
            className="pressable inline-flex h-[34px] items-center rounded-[9px] border border-[#3d3399] bg-linear-to-b from-[#5a4fc9] to-relvo px-3.5 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(74_63_181/0.35)] disabled:opacity-60"
          >
            Valider le sujet
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={dismiss}
            className="pressable inline-flex h-[34px] items-center rounded-[9px] border border-(--hairline) bg-white px-3.5 text-[13.5px] font-semibold text-(--text-secondary) shadow-surface-1 disabled:opacity-60"
          >
            Pas encore
          </button>
        </div>
      </div>
    </section>
  );
}
