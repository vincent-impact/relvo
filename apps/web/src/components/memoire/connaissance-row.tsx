"use client";

import { FileText } from "@/components/shared/picto";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { RelvoLogo } from "@/components/layout/relvo-logo";

// Une ligne de l'onglet Connaissances d'un dossier : l'icône, le nom, le
// moment, et l'état de lecture par Relvo. Elle S'OUVRE au tap, par le même
// geste que toute pièce (recette R18). Composant CLIENT pour la même raison
// que `DocumentRow` : une icône pleine passée en enfant d'un composant client
// depuis la page serveur traverse la frontière sans clés (`PITFALLS.md` #58).

export function ConnaissanceRow({
  id,
  name,
  mimeType,
  detail,
  etat,
}: {
  id: string;
  name: string;
  mimeType: string | null;
  /** Le moment et l'étiquette, déjà formatés (« 1 h · Contrat »). */
  detail: string;
  etat: "read" | "pending" | "ignored";
}) {
  return (
    <AttachmentViewer
      id={id}
      name={name}
      mimeType={mimeType}
      source="document"
      className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left active:bg-(--fond-enfonce)"
    >
      <span className="grid size-[34px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-(--fond-puce) text-gris">
        <FileText className="size-[18px]" />
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[14.5px] leading-[18px] font-normal text-noir">
          {name}
        </span>
        <span className="mt-0.5 block text-[12px] leading-4 font-normal text-gris">
          {detail}
        </span>
      </span>
      {etat === "read" ? (
        <span className="inline-flex flex-none items-center gap-1 rounded-(--rayon-pilule) bg-relvo-pale px-2 py-0.5 text-[11px] font-medium text-relvo">
          <RelvoLogo size={11} variant="full" title="" />
          Lu
        </span>
      ) : etat === "pending" ? (
        <span className="flex-none rounded-(--rayon-pilule) border border-dashed border-(--gris-clair) px-2 py-0.5 text-[11px] font-medium text-gris">
          À lire
        </span>
      ) : (
        <span className="flex-none rounded-(--rayon-pilule) bg-(--fond-puce) px-2 py-0.5 text-[11px] font-medium text-gris">
          Écarté
        </span>
      )}
    </AttachmentViewer>
  );
}
