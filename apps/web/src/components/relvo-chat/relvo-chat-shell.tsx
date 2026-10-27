"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Plus, X } from "lucide-react";
import { ClockCounterClockwise } from "@/components/shared/picto";
import { MobileFrame } from "@/components/layout/mobile-frame";
import {
  RelvoHeader,
  SKY_BTN,
  SkyTail,
} from "@/components/layout/relvo-header";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { RecipientComposer } from "@/components/shared/recipient-composer";
import { RelvoFil } from "@/components/relvo-chat/relvo-fil";
import { InvitationNotifications } from "@/components/relvo-chat/invitation-notifications";
import { QuestionsRelvo } from "@/components/relvo-chat/questions-relvo";
import { PriseEnMain } from "@/components/relvo-chat/prise-en-main";
import type { CarteVivanteData } from "@/components/shared/carte-vivante";
import { PollRefresh } from "@/components/shared/poll-refresh";
import type { SubjectRowData } from "@/components/shared/subject-row";
import type { OpenQuestion } from "@relvo/db";
import type { RelvoUIMessage } from "@/server/ia/echange/outils";
import { doitReprendre, titreParDefaut } from "@/lib/echanges-regles";
import {
  dernierEchange,
  lireEchange,
  sauverEchange,
  type EchangeStocke,
} from "@/lib/echanges-store";

// L'échange avec Relvo, plein écran (M10.1 à M10.6, M10.14). Relvo parle en
// premier (invariant 36) : l'état vide est un BLOC DE RELVO avec des invites
// fléchées, jamais de fausses bulles (invariant 28). Dès le premier tour, le
// fil prend la place. Le composer est CELUI des conversations ; un envoi part
// à la route de l'échange, qui répond en flux (`useChat`).
//
// Page-aware (invariant 26) : la page d'origine voyage avec chaque tour
// (`from`), et la puce de contexte s'efface d'un × pour passer en discussion
// générale — sans quitter la page, le retour reste celui d'origine.
//
// La mémoire est celle de l'APPAREIL (invariant 23, 05 §11.3) : l'échange se
// sauve dans IndexedDB à chaque tour ; à l'ouverture, l'échange en cours se
// rouvre s'il date de moins de cinq minutes (05 §11.2), sinon un nouvel
// échange — `?nouveau=1` en force un, `?reprendre=<id>` rouvre un échange de
// l'historique. Le titre est demandé à la fin du premier tour (M10.4).
//
// Relvo parle en premier (invariant 36) : ses questions ouvertes se posent en
// tête, en formulaire (M18.9), et la lecture du courrier en cours se montre
// en carte vivante qui se rafraîchit (M10.16) — avant le fil, quel qu'il soit.

type Initial = Pick<EchangeStocke, "id" | "titre" | "creeLe" | "messages">;

export function RelvoChatShell({
  backHref,
  from,
  contextLabel,
  prompts,
  initialText = "",
  nouveau = false,
  reprendre = null,
  questions = [],
  lecture = null,
  sujets = [],
  clePublique = null,
}: {
  backHref: string;
  /** La page d'origine, transmise à chaque tour. */
  from: string | null;
  /** Libellé de la puce page-aware (le titre d'un sujet, « Sujets »), ou null. */
  contextLabel: string | null;
  prompts: string[];
  /** Premier tour proposé (une suggestion de l'accueil) : pré-rempli, jamais envoyé seul. */
  initialText?: string;
  /** « + Nouvel échange » : on ne rouvre rien. */
  nouveau?: boolean;
  /** Un échange de l'historique à rouvrir. */
  reprendre?: string | null;
  /** Les questions de Relvo en attente, dans l'ordre où il les a posées. */
  questions?: OpenQuestion[];
  /** La lecture du courrier en cours, ou null. */
  lecture?: CarteVivanteData | null;
  /** Les sujets nés de cette lecture, sous la carte. */
  sujets?: SubjectRowData[];
  /** La clé publique VAPID : l'invitation à activer les notifications, quand les questions sont traitées. */
  clePublique?: string | null;
}) {
  // Ce que l'appareil sait de l'échange à ouvrir — lu AVANT de monter le fil,
  // parce que les messages initiaux du hook ne se posent qu'une fois.
  const [initial, setInitial] = useState<Initial | null>(null);
  useEffect(() => {
    let vivant = true;
    (async () => {
      if (reprendre) {
        const e = await lireEchange(reprendre);
        if (e && vivant) return setInitial(e);
      }
      if (!nouveau && !initialText) {
        const d = await dernierEchange();
        if (d && doitReprendre(d.dernierTourLe) && vivant) return setInitial(d);
      }
      if (vivant) {
        setInitial({
          id: crypto.randomUUID(),
          titre: null,
          creeLe: new Date().toISOString(),
          messages: [],
        });
      }
    })();
    return () => {
      vivant = false;
    };
  }, [reprendre, nouveau, initialText]);

  if (!initial) {
    return (
      <MobileFrame>
        <RelvoHeader back={backHref} title="Relvo" tail={false} />
        <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4">
          <SkyTail className="-mx-4 -mt-4" />
          <div className="h-[150px] animate-pulse rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale" />
        </main>
      </MobileFrame>
    );
  }

  return (
    <RelvoSession
      key={initial.id}
      initial={initial}
      backHref={backHref}
      from={from}
      contextLabel={contextLabel}
      prompts={prompts}
      initialText={initialText}
      questions={questions}
      lecture={lecture}
      sujets={sujets}
      clePublique={clePublique}
    />
  );
}

function RelvoSession({
  initial,
  backHref,
  from,
  contextLabel,
  prompts,
  initialText,
  questions,
  lecture,
  sujets,
  clePublique,
}: {
  initial: Initial;
  backHref: string;
  from: string | null;
  contextLabel: string | null;
  prompts: string[];
  initialText: string;
  questions: OpenQuestion[];
  lecture: CarteVivanteData | null;
  sujets: SubjectRowData[];
  clePublique: string | null;
}) {
  // Une invite touchée se pose dans le composer : le composant repart avec
  // ce texte (la clé change), l'utilisateur l'envoie ou le corrige.
  const [seed, setSeed] = useState(initialText);
  const [seedKey, setSeedKey] = useState(0);
  const [general, setGeneral] = useState(false);
  const [titre, setTitre] = useState<string | null>(initial.titre);

  // La page et le mode voyagent avec CHAQUE tour (corps de la requête), pas
  // avec le transport : la bascule en discussion générale vaut dès le tour
  // suivant.
  const [transport] = useState(
    () => new DefaultChatTransport<RelvoUIMessage>({ api: "/api/relvo" }),
  );
  const { messages, sendMessage, status, error, regenerate } =
    useChat<RelvoUIMessage>({
      id: initial.id,
      transport,
      messages: initial.messages,
      onFinish: ({ messages: tous }) => {
        // Le titre, à la fin du PREMIER tour (M10.4) : un appel de
        // classification ; en attendant, le repli posé à la sauvegarde.
        if (initial.titre) return;
        if (tous.filter((m) => m.role === "assistant").length !== 1) return;
        const question = texteDe(tous.find((m) => m.role === "user"));
        const reponse = texteDe(
          [...tous].reverse().find((m) => m.role === "assistant"),
        );
        if (!question || !reponse) return;
        void fetch("/api/relvo/titre", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, reponse }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { titre?: string | null } | null) => {
            if (j?.titre) setTitre(j.titre);
          })
          .catch(() => undefined);
      },
    });
  const busy = status === "submitted" || status === "streaming";

  // La sauvegarde sur l'appareil, à chaque tour posé — jamais en plein flux.
  useEffect(() => {
    if (status === "streaming" || messages.length === 0) return;
    void sauverEchange({
      id: initial.id,
      titre: titre ?? titreParDefaut(texteDe(messages[0]) ?? ""),
      creeLe: initial.creeLe,
      dernierTourLe: new Date().toISOString(),
      page: from,
      messages,
    });
  }, [messages, status, titre, initial.id, initial.creeLe, from]);

  function fill(text: string) {
    setSeed(text);
    setSeedKey((k) => k + 1);
  }

  // Le fil suit ce qui arrive : on reste en bas tant que Relvo écrit.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = mainRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const vide = messages.length === 0;
  const nouveauHref = `/relvo?nouveau=1${from ? `&from=${encodeURIComponent(from)}` : ""}`;

  return (
    <MobileFrame>
      {/* Le ciel est FIXE : sa queue se pose en tête de ce qui défile. */}
      <RelvoHeader
        back={backHref}
        title="Relvo"
        tail={false}
        action={
          <div className="flex items-center gap-2">
            {!vide ? (
              <Link
                href={nouveauHref}
                aria-label="Nouvel échange"
                className={SKY_BTN}
              >
                <Plus className="size-[18px]" strokeWidth={2.4} />
              </Link>
            ) : null}
            <Link
              href="/relvo/historique"
              aria-label="Mes échanges"
              className={SKY_BTN}
            >
              <ClockCounterClockwise className="size-[18px]" />
            </Link>
          </div>
        }
      />

      <main
        ref={mainRef}
        className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4 pb-6"
      >
        <SkyTail className="-mx-4 -mt-4" />
        {contextLabel && !general ? (
          <div className="mb-3 flex">
            <span className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-(--rayon-pilule) border border-(--filet) bg-white pr-1 pl-3 text-[13px] font-normal text-noir shadow-carte">
              <span className="truncate">{contextLabel}</span>
              <button
                type="button"
                onClick={() => setGeneral(true)}
                aria-label="Quitter ce contexte"
                className="relative grid size-7 flex-none place-items-center rounded-full text-gris before:absolute before:-inset-2 before:content-[''] active:bg-(--fond-puce)"
              >
                <X className="size-3.5" strokeWidth={2.4} />
              </button>
            </span>
          </div>
        ) : null}

        {lecture ? (
          <>
            <PriseEnMain lecture={lecture} sujets={sujets} />
            {lecture.status === "pending" || lecture.status === "running" ? (
              <PollRefresh intervalMs={20_000} />
            ) : null}
          </>
        ) : null}
        <QuestionsRelvo questions={questions} />
        {/* La dernière étape de la prise en main : les notifications de CET
            appareil, une fois les questions du compte traitées. */}
        {questions.length === 0 ? (
          <InvitationNotifications clePublique={clePublique} />
        ) : null}

        {vide ? (
          <RelvoBlock className="pb-2">
            <RelvoSentence>Dites-moi ce que vous voulez faire.</RelvoSentence>
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => fill(p)}
                className="mt-0.5 block w-full py-1.5 pl-[1.1em] text-left -indent-[1.1em] text-[14px] leading-[18px] font-medium text-relvo active:opacity-80"
              >
                → {p}
              </button>
            ))}
          </RelvoBlock>
        ) : (
          <RelvoFil
            messages={messages}
            status={status}
            error={error}
            onRetry={() => regenerate({ body: { from, general } })}
          />
        )}
      </main>

      <RecipientComposer
        key={seedKey}
        placeholder="Écrire à Relvo…"
        defaultValue={seed}
        dictee
        onSend={(text) => {
          // Un tour à la fois : le texte reste dans le champ tant que Relvo écrit.
          if (busy) return false;
          void sendMessage({ text }, { body: { from, general } });
          return true;
        }}
      />
    </MobileFrame>
  );
}

/** Le texte d'un message de l'interface, ou null. */
function texteDe(m: RelvoUIMessage | undefined): string | null {
  if (!m) return null;
  const t = m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  return t || null;
}
