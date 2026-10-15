"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OpenQuestion, QuestionOutcome } from "@relvo/db";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { EtapeFormulaire } from "@/components/relvo-chat/etape-formulaire";
import {
  ecarterQuestionAction,
  repondreQuestionAction,
} from "@/server/actions/relvo";

// Les QUESTIONS DE RELVO dans l'échange (M18.9, 05 §11.12) : Relvo parle en
// premier. Une question ouverte se pose en tête de l'échange, en FORMULAIRE
// (05 §11.11) — une question courte, des réponses complètes, « Je vous
// l'écris… » pour une réponse libre, « Plus tard » qui la laisse ouverte,
// « Ne plus demander » qui l'écarte. Une seule à la fois, dans l'ordre où
// Relvo les a posées. La réponse passe par la même fonction du domaine que la
// fiche ; ce qu'elle a fait s'affiche en une phrase.

const CLE_AUTRE = "autre";
const PLUS_TARD = "__plus_tard";
const ECARTER = "__ecarter";

function phraseOutcome(o: QuestionOutcome): string {
  switch (o.kind) {
    case "sectors":
      return "C’est noté : je lirai votre courrier avec les mots de votre métier.";
    case "instruction":
      return `C’est noté dans votre Mémoire, dans ${o.folderName} : je l’appliquerai.`;
    case "noted":
      return "C’est noté, merci.";
  }
}

export function QuestionsRelvo({ questions }: { questions: OpenQuestion[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [reponduEn, setReponduEn] = useState<string | null>(null);
  const [libre, setLibre] = useState(false);
  const [texte, setTexte] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const question = questions[index] ?? null;
  if (!question && !reponduEn) return null;

  function suivante() {
    setLibre(false);
    setTexte("");
    setIndex((i) => i + 1);
  }

  function repondre(key: string | null, answer: string) {
    if (!question) return;
    setBusyKey(key ?? CLE_AUTRE);
    setError(null);
    start(async () => {
      const res = await repondreQuestionAction(question.id, { key, answer });
      setBusyKey(null);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setReponduEn(phraseOutcome(res.data.outcome));
      suivante();
      router.refresh();
    });
  }

  function choisir(key: string) {
    if (!question) return;
    if (key === PLUS_TARD) return suivante();
    if (key === ECARTER) {
      setBusyKey(key);
      start(async () => {
        const res = await ecarterQuestionAction(question.id);
        setBusyKey(null);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        suivante();
        router.refresh();
      });
      return;
    }
    if (key === CLE_AUTRE) return setLibre(true);
    const option = question.proposedAnswers.find((p) => p.key === key);
    repondre(key, option?.label ?? key);
  }

  return (
    <div className="mb-3 space-y-3">
      {reponduEn ? (
        <RelvoBlock className="pb-2.5" label="Relvo a noté votre réponse">
          <RelvoSentence>✦ {reponduEn}</RelvoSentence>
        </RelvoBlock>
      ) : null}
      {question ? (
        <RelvoBlock className="pb-3" label="Une question de Relvo">
          {question.about ? (
            <p className="mt-1 text-[12px] font-normal text-gris">
              À propos de {question.about.label}
            </p>
          ) : null}
          <EtapeFormulaire
            question={question.text}
            options={[
              ...question.proposedAnswers
                .filter((p) => p.key !== CLE_AUTRE)
                .map((p) => ({ key: p.key, label: p.label, hint: p.hint })),
              {
                key: CLE_AUTRE,
                label:
                  question.proposedAnswers.find((p) => p.key === CLE_AUTRE)
                    ?.label ?? "Autre…",
                hint: libre ? undefined : "Une réponse en quelques mots",
              },
              { key: PLUS_TARD, label: "Plus tard", secondary: true },
              {
                key: ECARTER,
                label: "Ne plus me le demander",
                secondary: true,
              },
            ]}
            onChoose={choisir}
            busyKey={busyKey}
            error={error}
          />
          {libre ? (
            <form
              className="mt-2.5 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (texte.trim()) repondre(CLE_AUTRE, texte.trim());
              }}
            >
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Votre réponse…"
                className="min-h-12 flex-1 resize-none rounded-(--rayon-option) border border-(--filet) bg-white px-3.5 py-2.5 text-[14.5px] leading-[1.4] text-noir outline-none focus:border-relvo"
              />
              <button
                type="submit"
                disabled={!texte.trim() || busyKey !== null}
                className="pressable h-12 flex-none rounded-(--rayon-pilule) px-4 text-[14px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--degrade-relvo)" }}
              >
                Envoyer
              </button>
            </form>
          ) : null}
        </RelvoBlock>
      ) : null}
    </div>
  );
}
