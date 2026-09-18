"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ListPanel } from "@/components/shared/list-panel";
import { prepareDraftAction } from "@/server/actions/brouillon";
import { answerTaskDecisionAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// DecisionSheet — LE FORMULAIRE DE DÉCISIONS d'un fil (05 §3.1, retour du
// troisième essai réel, 2026-09-16). Ce qu'un message demande au dirigeant —
// valider un devis, choisir une contenance, donner un créneau — Relvo l'a
// résumé en questions courtes sur la tâche qui se répond. Le panneau vit dans
// la conversation, entre le dernier message et le composer : on répond en
// relisant le message.
//
//   • Une question = une ligne : sa précision (montant, délai), ses options en
//     puces, « Autre… » pour une réponse libre. Répondre est immédiat et
//     journalisé ; « Changer » repasse par là.
//   • « Rédiger la réponse » ne s'allume qu'une fois TOUT répondu : Relvo ne
//     rédige pas sur une question ouverte. Le brouillon se pose ensuite dans le
//     composer, et le panneau se replie en une ligne vérifiable.
//   • Le composer reste libre : ignorer le formulaire et écrire soi-même est
//     un choix légitime — l'envoi coche la tâche par correspondance.
// Remplace les choix entre crochets dans le texte, qui ne fonctionnaient pas.

export type SheetDecision = {
  id: string;
  question: string;
  precision: string | null;
  options: string[];
  reponse: string | null;
};

export type SheetTask = {
  id: string;
  title: string;
  /** Terminée : ce qui a été décidé reste lisible, sans rien à répondre. */
  status: "open" | "done";
  decisions: SheetDecision[];
};

// Le panneau est TEINTÉ Relvo — violet clair, liseré violet — parce qu'un
// panneau blanc se confondait avec un message du fil (retour du 2026-09-18) :
// c'est une assistance de Relvo, pas une suite de la conversation.
const RELVO_PANEL = "mx-4 mt-2 border-(--purple-100) bg-relvo-bg shadow-none";

/** Ce qui a été décidé, une fois la tâche terminée : une ligne Relvo, sans action. */
export function DecisionRecord({ task }: { task: SheetTask }) {
  const prises = task.decisions.filter((d) => d.reponse !== null);
  if (prises.length === 0) return null;
  return (
    <ListPanel className={RELVO_PANEL}>
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13.5px] text-(--text-primary)">
        <Sparkles
          className="mt-0.5 size-3.5 flex-none text-relvo"
          fill="currentColor"
          strokeWidth={0}
        />
        <span className="min-w-0 flex-1">
          <span className="font-bold text-relvo">Décidé avec Relvo</span>
          {prises.map((d) => (
            <span key={d.id} className="block">
              {d.question} <b className="font-semibold">{d.reponse}</b>
            </span>
          ))}
        </span>
      </div>
    </ListPanel>
  );
}

export function DecisionSheet({
  task,
  onDraft,
}: {
  task: SheetTask;
  /** Le brouillon rédigé une fois tout répondu — à poser dans le composer. */
  onDraft: (draft: { actionId: string; contenu: string }) => void;
}) {
  const [decisions, setDecisions] = useState(task.decisions);
  const [drafted, setDrafted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();
  const total = decisions.length;
  const answered = decisions.filter((d) => d.reponse !== null).length;
  const complete = total > 0 && answered === total;

  function answer(decisionId: string, reponse: string) {
    const previous = decisions;
    setDecisions((ds) =>
      ds.map((d) => (d.id === decisionId ? { ...d, reponse } : d)),
    );
    startTransition(async () => {
      const res = await answerTaskDecisionAction({
        taskId: task.id,
        decisionId,
        reponse,
      });
      if (!res.ok) {
        setDecisions(previous);
        toast.error(res.message);
      }
    });
  }

  async function rediger() {
    setDrafting(true);
    try {
      const res = await prepareDraftAction(task.id);
      if (res.ok) {
        onDraft({ actionId: res.data.actionId, contenu: res.data.contenu });
        setDrafted(true);
        setCollapsed(true);
      } else {
        toast.error(res.message);
      }
    } finally {
      setDrafting(false);
    }
  }

  if (collapsed) {
    // Replié : ce qui a été décidé, vérifiable d'un coup d'œil, et « Changer ».
    return (
      <ListPanel className={RELVO_PANEL}>
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px]">
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-relvo text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {decisions.map((d, i) => (
              <span key={d.id}>
                {i > 0 ? " · " : ""}
                <b className="font-semibold">{d.reponse}</b>
              </span>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex-none text-[12.5px] font-semibold text-(--text-secondary) active:opacity-70"
          >
            Changer
          </button>
        </div>
      </ListPanel>
    );
  }

  return (
    <ListPanel className={RELVO_PANEL}>
      <div className="flex items-center gap-2 border-b border-(--purple-100) px-3.5 py-2.5 text-[12px] font-bold text-relvo">
        <Sparkles className="size-3.5" fill="currentColor" strokeWidth={0} />
        <span className="min-w-0 flex-1 truncate">
          Relvo · ce message attend {total} décision{total > 1 ? "s" : ""}
        </span>
        <span className="font-numeric font-semibold text-(--text-tertiary)">
          {answered} / {total}
        </span>
      </div>

      {decisions.map((d) => (
        <DecisionLine
          key={d.id}
          decision={d}
          disabled={pending || drafting}
          onAnswer={(r) => answer(d.id, r)}
        />
      ))}

      <div className="flex items-center gap-3 px-3.5 py-2.5 text-[12.5px] text-(--text-secondary)">
        <span className="min-w-0 flex-1">
          {complete
            ? drafted
              ? "Réponse rédigée. Relvo peut la refaire."
              : "Relvo peut rédiger."
            : `Encore ${total - answered} réponse${total - answered > 1 ? "s" : ""}.`}
        </span>
        <button
          type="button"
          disabled={!complete || drafting || pending}
          onClick={rediger}
          className="flex-none rounded-full bg-relvo px-4 py-1.5 text-[13px] font-bold text-white active:opacity-90 disabled:bg-[#d4d2cc]"
        >
          {drafting ? "Relvo rédige…" : "Rédiger la réponse"}
        </button>
      </div>
    </ListPanel>
  );
}

/** Une décision : la question, sa précision, ses options — et « Autre… ». */
function DecisionLine({
  decision,
  disabled,
  onAnswer,
}: {
  decision: SheetDecision;
  disabled: boolean;
  onAnswer: (reponse: string) => void;
}) {
  const isOption = decision.options.includes(decision.reponse ?? "");
  const [free, setFree] = useState(
    decision.reponse !== null && !isOption ? decision.reponse : "",
  );
  const [freeOpen, setFreeOpen] = useState(
    decision.reponse !== null && !isOption,
  );
  const freeChosen = decision.reponse !== null && !isOption;

  return (
    <div className="border-b border-(--purple-100) px-3.5 py-3">
      <div className="text-[15px] leading-[1.3] font-semibold tracking-[-0.005em]">
        {decision.question}
      </div>
      {decision.precision ? (
        <div className="mt-0.5 text-[12.5px] text-(--text-secondary)">
          {decision.precision}
        </div>
      ) : null}
      <div
        className="mt-2.5 flex flex-wrap gap-2"
        role="group"
        aria-label={decision.question}
      >
        {decision.options.map((opt) => {
          const on = decision.reponse === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => {
                setFreeOpen(false);
                onAnswer(opt);
              }}
              className={cn(
                "pressable min-h-[38px] rounded-full border px-3.5 py-1.5 text-[14px] font-semibold",
                on
                  ? "border-transparent bg-relvo text-white"
                  : "border-[#d9d7d1] bg-white text-(--text-primary) shadow-surface-1",
              )}
            >
              {opt}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={freeChosen}
          onClick={() => setFreeOpen((o) => !o)}
          className={cn(
            "min-h-[38px] rounded-full border border-dashed px-3.5 py-1.5 text-[14px] font-semibold",
            freeChosen
              ? "border-relvo bg-relvo-bg text-relvo"
              : "border-[#d4d2cc] bg-transparent text-(--text-tertiary)",
          )}
        >
          {freeChosen && !freeOpen ? decision.reponse : "Autre…"}
        </button>
      </div>
      {freeOpen ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = free.trim();
            if (!v) return;
            setFreeOpen(false);
            onAnswer(v);
          }}
        >
          <input
            id={`decision-${decision.id}-autre`}
            value={free}
            onChange={(e) => setFree(e.target.value)}
            autoFocus
            placeholder="Votre réponse…"
            className="min-w-0 flex-1 rounded-xl border border-(--border) bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={disabled || !free.trim()}
            className="rounded-full bg-(--text-primary) px-3.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            OK
          </button>
        </form>
      ) : null}
    </div>
  );
}
