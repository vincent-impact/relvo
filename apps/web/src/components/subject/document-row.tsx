"use client";

import { PieceIcone } from "@/components/shared/piece-icone";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import type { EtatPiece } from "@/lib/pieces";

// Une ligne de l'onglet Documents de la fiche : l'icône, le nom, ce que Relvo
// a lu dans la pièce, le moment. Composant CLIENT pour que l'icône pleine
// (Phosphor) soit rendue de ce côté-ci : passée en enfant d'un composant
// client depuis la page serveur, ses chemins traversent la frontière sans
// clés et React s'en plaint à chaque rendu.

export function DocumentRow({
  id,
  name,
  mimeType,
  label,
  time,
  etat = "stockee",
  vignette = null,
}: {
  id: string;
  name: string;
  mimeType: string | null;
  /** Où en est la pièce (M25.3) : une référence se charge à l'ouverture. */
  etat?: EtatPiece;
  /** Sa vignette, montrée le temps que l'original arrive. */
  vignette?: string | null;
  /** L'étiquette posée par Relvo (« Bon de livraison »), ou rien. */
  label: string | null;
  /** Le moment, déjà formaté (« 1 h »). */
  time: string | null;
}) {
  return (
    <AttachmentViewer
      id={id}
      name={name}
      mimeType={mimeType}
      enAttente={etat !== "stockee"}
      vignette={vignette}
      className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left active:bg-(--fond-enfonce)"
    >
      <PieceIcone name={name} mimeType={mimeType} />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[14.5px] leading-[18px] font-normal text-noir">
          {name}
        </span>
        {label ? (
          <span className="mt-0.5 inline-block rounded-full bg-(--fond-puce) px-[7px] py-px text-[11px] font-medium text-gris">
            {label}
          </span>
        ) : null}
        {etat === "indisponible" ? (
          <span className="block text-[12px] leading-4 font-normal text-gris">
            Plus disponible à la source
          </span>
        ) : null}
      </span>
      {time ? (
        <span className="chiffre flex-none text-[12px] text-gris">{time}</span>
      ) : null}
    </AttachmentViewer>
  );
}
