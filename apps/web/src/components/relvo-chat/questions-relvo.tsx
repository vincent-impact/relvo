"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OpenQuestion, QuestionOutcome } from "@relvo/db";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { EtapeChoixMultiples } from "@/components/relvo-chat/etape-choix-multiples";
import { EtapeFormulaire } from "@/components/relvo-chat/etape-formulaire";
import {
  connecterBoiteDepuisEchangeAction,
  ecarterQuestionAction,
  migrerBoiteDepuisEchangeAction,
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
      return o.metier
        ? `C’est noté : ${o.metier}. Je lirai votre courrier avec les mots de votre métier.`
        : "C’est noté : je lirai votre courrier avec les mots de votre métier.";
    case "instruction":
      return `C’est noté dans le dossier ${o.folderName} : je l’appliquerai.`;
    case "folders":
      return o.names.length === 1
        ? `C’est fait : le dossier ${o.names[0]} est créé. J’y rangerai les sujets qui s’y rapportent.`
        : `C’est fait : les dossiers ${o.names.join(", ")} sont créés. J’y rangerai les sujets qui s’y rapportent.`;
    case "folder-created":
      return `C’est fait : le dossier « ${o.name} » existe, ${o.reclassees} sujet${o.reclassees > 1 ? "s y sont rangées" : " y est rangée"}.`;
    case "lecture-etendue":
      return "C’est parti : je lis deux semaines de plus. Les sujets apparaîtront à mesure.";
    case "noted":
      return "C’est noté, merci.";
  }
}

export function QuestionsRelvo({ questions }: { questions: OpenQuestion[] }) {
  const router = useRouter();
  // Les questions TRAITÉES dans cette session — répondues, écartées, remises
  // à plus tard — par identifiant, jamais par rang : la liste se rafraîchit
  // après chaque réponse (elle rétrécit, une étape du script peut naître), et
  // un rang qui avance sur une liste qui bouge saute une question.
  const [traitees, setTraitees] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [reponduEn, setReponduEn] = useState<string | null>(null);
  const [libre, setLibre] = useState(false);
  /** La clé sous laquelle la réponse libre part : « Autre… », ou une réponse qui s'écrit. */
  const [cleLibre, setCleLibre] = useState<string>(CLE_AUTRE);
  const [texte, setTexte] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const question = questions.find((q) => !traitees.has(q.id)) ?? null;
  if (!question && !reponduEn) return null;

  function suivante() {
    if (!question) return;
    const id = question.id;
    setLibre(false);
    setCleLibre(CLE_AUTRE);
    setTexte("");
    setTraitees((t) => new Set([...t, id]));
  }

  function repondre(key: string | null, answer: string, keys?: string[]) {
    if (!question) return;
    setBusyKey(key ?? CLE_AUTRE);
    setError(null);
    start(async () => {
      const res = await repondreQuestionAction(question.id, {
        key,
        keys,
        answer,
      });
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
    const option = question.proposedAnswers.find((p) => p.key === key);
    if (key === CLE_AUTRE || option?.libre) {
      setCleLibre(key);
      return setLibre(true);
    }
    // La boîte à lire (05 §11.11) : la clé « gmail » ouvre le consentement
    // Google (la même que `CLE_RELIER_BOITE` du domaine — pas d'import d'une
    // valeur de `@relvo/db` dans un composant client), et c'est la connexion
    // qui fermera la question — pas ce clic. « Non, c'est tout » répond.
    if (question.connecteBoite && key === "gmail") {
      setBusyKey(key);
      setError(null);
      start(async () => {
        const res = await connecterBoiteDepuisEchangeAction(key);
        if (res.ok) {
          window.location.href = res.data.url;
          return;
        }
        setBusyKey(null);
        setError(res.message);
      });
      return;
    }
    // La boîte à passer au relais (M24.9) : la même clé rouvre le consentement
    // Google sur CE canal, et c'est la bascule qui fermera la question.
    if (question.migreBoite && key === "gmail") {
      const channelId = question.migreBoite;
      setBusyKey(key);
      setError(null);
      start(async () => {
        const res = await migrerBoiteDepuisEchangeAction(channelId);
        if (res.ok) {
          window.location.href = res.data.url;
          return;
        }
        setBusyKey(null);
        setError(res.message);
      });
      return;
    }
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
          {question.multiple ? (
            // Les domaines typiques se GARDENT à plusieurs (05 §9.6) : la
            // même forme, qui se coche ; « Plus tard » laisse la question.
            <EtapeChoixMultiples
              question={question.text}
              options={[
                ...question.proposedAnswers
                  .filter((p) => p.key !== "aucun")
                  .map((p) => ({ key: p.key, label: p.label, hint: p.hint })),
                ...question.proposedAnswers
                  .filter((p) => p.key === "aucun")
                  .map((p) => ({
                    key: p.key,
                    label: p.label,
                    secondary: true,
                  })),
                { key: PLUS_TARD, label: "Plus tard", secondary: true },
              ]}
              onChoose={(keys) => {
                if (keys.includes(PLUS_TARD)) return suivante();
                const labels = question.proposedAnswers
                  .filter((p) => keys.includes(p.key))
                  .map((p) => p.label);
                repondre(keys[0] ?? null, labels.join(", "), keys);
              }}
              busy={busyKey !== null}
              error={error}
            />
          ) : (
            <EtapeFormulaire
              question={question.text}
              options={[
                ...question.proposedAnswers
                  .filter((p) => p.key !== CLE_AUTRE)
                  .map((p) => ({ key: p.key, label: p.label, hint: p.hint })),
                // Une boîte ne s'écrit pas : pas de réponse libre à cette étape.
                // Et quand une réponse proposée s'écrit déjà (« Un autre
                // métier », « Il en manque »), « Autre… » ferait doublon.
                ...(question.connecteBoite ||
                question.migreBoite ||
                question.proposedAnswers.some((p) => p.libre)
                  ? []
                  : [
                      {
                        key: CLE_AUTRE,
                        label:
                          question.proposedAnswers.find(
                            (p) => p.key === CLE_AUTRE,
                          )?.label ?? "Autre…",
                        hint: libre
                          ? undefined
                          : "Une réponse en quelques mots",
                      },
                    ]),
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
          )}
          {libre ? (
            <form
              className="mt-2.5 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (texte.trim()) repondre(cleLibre, texte.trim());
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
