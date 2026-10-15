"use client";

import { FileText } from "@/components/shared/picto";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";

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
}: {
  id: string;
  name: string;
  mimeType: string | null;
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
      className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left active:bg-(--fond-enfonce)"
    >
      <span className="grid size-[34px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-(--fond-puce) text-gris">
        <FileText className="size-[18px]" />
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[14.5px] leading-[18px] font-normal text-noir">
          {name}
        </span>
        {label ? (
          <span className="mt-0.5 inline-block rounded-full bg-(--fond-puce) px-[7px] py-px text-[11px] font-medium text-gris">
            {label}
          </span>
        ) : null}
      </span>
      {time ? (
        <span className="chiffre flex-none text-[12px] text-gris">{time}</span>
      ) : null}
    </AttachmentViewer>
  );
}
