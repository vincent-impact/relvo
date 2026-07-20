"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SubjectPickerDialog,
  type SubjectPickerOption,
} from "@/components/messages/subject-picker-dialog";
import { MessageBubble } from "@/components/shared/message-bubble";
import {
  assignMessageAction,
  createSubjectFromMessageAction,
  detachMessageAction,
} from "@/server/actions/messages";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  function close() {
    setSelectedId(null);
    setPicking(false);
  }

  function detach() {
    if (!selected) return;
    startTransition(async () => {
      const res = await detachMessageAction(selected.id);
      if (res.ok) {
        toast.success("Message détaché");
        close();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  /** « Ouvrir un sujet » : CE message devient l'ancre de la nouvelle fenêtre. */
  function openSubject() {
    if (!selected) return;
    startTransition(async () => {
      const res = await createSubjectFromMessageAction(selected.id);
      if (res.ok) {
        toast.success("Sujet ouvert");
        close();
        router.push(
          `/sujets/${res.data.id}?from=${encodeURIComponent(backTo)}`,
        );
      } else {
        toast.error(res.message);
      }
    });
  }

  function attach(subjectId: string) {
    if (!selected) return;
    startTransition(async () => {
      const res = await assignMessageAction(selected.id, subjectId);
      if (res.ok) {
        toast.success("Message rattaché au sujet");
        close();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

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
              {/* Tap sur le message → pop-up d'affectation. On n'enveloppe PAS
                  la bulle dans un <button> : elle contient des liens (URLs
                  cliquables), et imbriquer un <a> dans un <button> est invalide.
                  D'où la garde sur `closest("a")` : un clic sur un lien ouvre le
                  lien, tout le reste ouvre la pop-up. */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a")) return;
                  setSelectedId(m.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedId(m.id);
                }}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer flex-col",
                  selectedId === m.id && "opacity-80",
                )}
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Pop-up message (M6bis.10) — deux visages selon que le message est
          couvert par une fenêtre ou non. */}
      <Dialog
        open={selected != null && !picking}
        onOpenChange={(o) => (o ? null : close())}
      >
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>
              {selected?.subject ? "Message rattaché" : "Message sans sujet"}
            </DialogTitle>
          </DialogHeader>

          {selected?.subject ? (
            <>
              <Link
                href={`/sujets/${selected.subject.id}?from=${encodeURIComponent(backTo)}`}
                className="flex items-center gap-3 rounded-xl border border-(--border-light) px-3.5 py-3 active:opacity-90"
              >
                <span
                  className="size-[10px] flex-none rounded-full"
                  style={{ background: cordColor(selected) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {selected.subject.title}
                  </span>
                  <span className="font-numeric text-[11.5px] text-(--text-tertiary)">
                    {selected.subject.reference}
                  </span>
                </span>
              </Link>

              <button
                type="button"
                disabled={pending}
                onClick={detach}
                className="flex items-center justify-center gap-2 rounded-xl border border-(--border) py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Unlink className="size-4" strokeWidth={2.2} />
                )}
                Détacher
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={openSubject}
                className="flex items-center justify-center gap-2 rounded-xl bg-relvo py-3 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Plus className="size-4" strokeWidth={2.4} />
                )}
                Ouvrir un sujet
              </button>
              <p className="px-1 text-[12px] leading-[1.45] text-(--text-tertiary)">
                Ce message devient l&apos;ancre du sujet : les messages qui
                suivront dans cette conversation lui reviendront
                automatiquement.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => setPicking(true)}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-(--border) py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
              >
                <Link2 className="size-4" strokeWidth={2.2} />
                Rattacher à un sujet existant
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SubjectPickerDialog
        open={picking}
        onOpenChange={(o) => (o ? setPicking(true) : close())}
        subjects={subjects}
        onSelect={attach}
        pending={pending}
      />
    </>
  );
}
