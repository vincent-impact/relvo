"use client";

import { useState } from "react";
import type { SubjectPickerOption } from "@/components/messages/subject-picker-dialog";
import { MessageBubble } from "@/components/shared/message-bubble";
import {
  MessageSubjectDialog,
  MessageTapArea,
} from "@/components/shared/message-subject-dialog";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { folderVisual } from "@/lib/folders";

// Fil d'une conversation (M6bis.9/.10) — timeline chronologique façon messagerie
// + LE CORDON DE SUJET.
//
// ── Le cordon ────────────────────────────────────────────────────────────────
// À gauche de chaque message, un point de la couleur du DOMAINE de son sujet.
// Deux messages CONSÉCUTIFS d'un même sujet sont reliés par un trait : le
// cordon. Un message sans sujet porte un point CREUX, jamais relié.
//
// Quand plusieurs sujets s'entrelacent dans un même fil (le cas WhatsApp qui a
// motivé toute la refonte M6bis), le cordon se BRISE et les couleurs alternent :
// cette rupture visuelle EST l'information — elle dit « ce fil mélange
// plusieurs affaires », ce qu'aucun regroupement temporel ne saurait montrer.
//
// UN SEUL RAIL, quel que soit le nombre de sujets. Des rails parallèles (un par
// sujet, façon graphe de branches git) seraient plus expressifs sur un écran
// large et illisibles sur un téléphone — or Relvo est mobile-first.

const RAIL_W = 22; // largeur de la colonne du cordon (px)
const DOT_TOP = 9; // hauteur du point, alignée sur la 1re ligne de la bulle
// Écart vertical entre deux messages : les segments du cordon DOIVENT le
// franchir, sinon le trait se couperait dans le vide entre deux bulles et
// suggérerait à tort une rupture de sujet. À garder d'accord avec le `gap` de
// la colonne des messages ci-dessous.
const GAP = 15;

/** Couleur du point d'un message : domaine du sujet, gris si aucun sujet. */
function cordColor(m: ThreadMessageData): string {
  if (!m.subject) return "var(--text-tertiary)";
  return folderVisual(m.subject.folder ?? undefined).color;
}

function Cord({
  color,
  hollow,
  linkedUp,
  linkedDown,
}: {
  color: string;
  hollow: boolean;
  linkedUp: boolean;
  linkedDown: boolean;
}) {
  return (
    <div
      aria-hidden
      className="relative flex-none self-stretch"
      style={{ width: RAIL_W }}
    >
      {/* Segment HAUT : relie au message précédent (même sujet). */}
      {linkedUp ? (
        <span
          className="absolute left-1/2 w-[2px] -translate-x-1/2"
          style={{ top: -GAP, height: DOT_TOP + GAP, background: color }}
        />
      ) : null}
      {/* Segment BAS : relie au message suivant (même sujet) — du point
          jusqu'au bas de la cellule, débordant de l'écart inter-messages. */}
      {linkedDown ? (
        <span
          className="absolute left-1/2 w-[2px] -translate-x-1/2"
          style={{ top: DOT_TOP, bottom: -GAP, background: color }}
        />
      ) : null}
      {/* Le point : plein = couvert par un sujet ; CREUX = hors de toute
          fenêtre (c'est ce qui reste à trier). */}
      <span
        className="absolute left-1/2 size-[9px] -translate-x-1/2 rounded-full"
        style={{
          top: DOT_TOP,
          background: hollow ? "white" : color,
          boxShadow: hollow ? `inset 0 0 0 2px ${color}` : "none",
        }}
      />
    </div>
  );
}

export function ConversationThread({
  messages,
  subjects,
  backTo,
}: {
  messages: ThreadMessageData[];
  /** Sujets candidats au rattachement (fenêtres encore ouvertes). */
  subjects: SubjectPickerOption[];
  /** Page d'origine, transmise aux liens vers une fiche sujet (`?from=`). */
  backTo: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  return (
    <>
      {/* `gap` piloté par GAP : le cordon doit franchir exactement cet écart. */}
      <div
        className="flex flex-col px-[18px] pt-4 pb-3"
        style={{ rowGap: GAP }}
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-(--text-tertiary)">
            Aucun message dans cette conversation.
          </p>
        ) : null}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const sid = m.subject?.id ?? null;
          // Le trait ne se dessine qu'entre messages CONSÉCUTIFS du même sujet :
          // deux messages du même sujet séparés par un message d'un autre sujet
          // restent visuellement séparés — c'est précisément l'entrelacement.
          const linkedUp = sid != null && prev?.subject?.id === sid;
          const linkedDown = sid != null && next?.subject?.id === sid;

          return (
            <div key={m.id} className="flex gap-1.5">
              <Cord
                color={cordColor(m)}
                hollow={!m.subject}
                linkedUp={linkedUp}
                linkedDown={linkedDown}
              />
              {/* Tap sur le message → pop-up d'affectation, partagée avec le fil
                  d'un sujet (MessageSubjectDialog). Le détail « <a> dans la
                  bulle » est encapsulé par MessageTapArea. */}
              <MessageTapArea
                onTap={() => setSelectedId(m.id)}
                active={selectedId === m.id}
                className="flex min-w-0 flex-1 flex-col"
              >
                <MessageBubble
                  data={{
                    id: m.id,
                    direction: m.direction,
                    actor: m.direction === "outgoing" ? "user" : "contact",
                    senderName: m.senderName,
                    time: m.time,
                    content: m.content,
                    attachment: m.attachment,
                  }}
                />
              </MessageTapArea>
            </div>
          );
        })}
      </div>

      {/* Pop-up message (M6bis.10) — SOURCE PARTAGÉE avec le fil d'un sujet
          (uniformisée le 2026-07-20) : même geste, même objet, même menu. */}
      <MessageSubjectDialog
        message={selected}
        onClose={() => setSelectedId(null)}
        subjects={subjects}
        backTo={backTo}
      />
    </>
  );
}
