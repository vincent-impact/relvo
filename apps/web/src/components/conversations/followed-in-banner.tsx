"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConversationListening } from "@relvo/db";
import { folderVisual } from "@/lib/folders";

// Bandeau « Suivi dans : … » (M6ter, invariant n°13bis) — LE signal
// d'appartenance côté conversation, sur les DEUX canaux. Il remplace le cordon :
// une conversation est soit écoutée par un sujet ouvert, soit pas — binaire.
//
// L'écoute ACTIVE est nommée en clair, avec la pastille de couleur du domaine,
// cliquable vers la fiche. Un discret « N sujets passés » déplie les écoutes
// TERMINÉES : sans ce dépliant, elles n'existeraient plus nulle part côté
// conversation (renoncement assumé n°2 du modèle).

function SubjectPill({
  listening,
  backTo,
  muted = false,
}: {
  listening: ConversationListening;
  backTo: string;
  muted?: boolean;
}) {
  const color = folderVisual(listening.folder ?? undefined).color;
  return (
    <Link
      href={`/sujets/${listening.subjectId}?from=${encodeURIComponent(backTo)}`}
      className="inline-flex items-center gap-1.5 active:opacity-80"
    >
      <span
        className="size-2 flex-none rounded-full"
        style={{ background: color }}
      />
      <span
        className={
          muted
            ? "text-[12.5px] text-(--text-tertiary) line-through decoration-(--text-tertiary)/40"
            : "text-[13px] font-semibold text-(--text-primary)"
        }
      >
        {listening.title}
      </span>
    </Link>
  );
}

export function FollowedInBanner({
  listenings,
  backTo,
}: {
  listenings: ConversationListening[];
  backTo: string;
}) {
  const [showPast, setShowPast] = useState(false);
  const active = listenings.find((l) => l.active) ?? null;
  const past = listenings.filter((l) => !l.active);

  // Aucune écoute, ni active ni passée → pas de bandeau (conversation à trier).
  if (!active && past.length === 0) return null;

  return (
    <div className="border-b border-(--border) bg-(--surface-2) px-[18px] py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {active ? (
          <>
            <span className="text-[12px] text-(--text-tertiary)">
              Suivi dans
            </span>
            <SubjectPill listening={active} backTo={backTo} />
          </>
        ) : (
          <span className="text-[12px] text-(--text-tertiary)">
            Plus suivi — écoute terminée
          </span>
        )}

        {past.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="ml-auto text-[11.5px] text-(--text-tertiary) underline decoration-dotted active:opacity-70"
          >
            {past.length} sujet{past.length > 1 ? "s" : ""} passé
            {past.length > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>

      {showPast && past.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-(--border) pt-2">
          {past.map((l) => (
            <SubjectPill
              key={l.subjectId}
              listening={l}
              backTo={backTo}
              muted
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
