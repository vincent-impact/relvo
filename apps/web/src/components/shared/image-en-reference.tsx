"use client";

import { useState } from "react";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { DownloadSimple, ImageSquare } from "@/components/shared/picto";
import { adresseDeVignette } from "@/lib/medias";
import { formatPoids } from "@/lib/pieces";
import { cn } from "@/lib/utils";

// Une IMAGE GARDÉE EN RÉFÉRENCE dans un fil (M25.3, M25.5) : Relvo ne l'a pas
// stockée, il n'en a que la vignette que le réseau joint au message. Le fil la
// montre, floue — elle fait quelques dizaines de pixels —, avec son poids ; le
// tap ouvre la visionneuse, qui va chercher l'original à la source. Une fois
// arrivé il est stocké : la tuile devient l'image elle-même, sans recharger la
// page.
//
// ⚠️ Tant qu'elle n'est pas chargée, cette tuile n'appelle JAMAIS une route de
// la pièce : `/download` irait la chercher sans qu'on l'ait demandée.

export function ImageEnReference({
  id,
  name,
  mimeType,
  vignette,
  taille,
  indisponible,
  className,
}: {
  id: string;
  name: string;
  mimeType?: string | null;
  /** JPEG en base64, ou rien : la tuile est alors neutre. */
  vignette: string | null;
  /** Le poids annoncé, en octets. */
  taille: number | null;
  /** La source ne la sert plus : on le dit, le tap retente quand même. */
  indisponible: boolean;
  className?: string;
}) {
  const [chargee, setChargee] = useState(false);
  const apercu = adresseDeVignette(vignette);
  const mention = indisponible
    ? "Plus disponible"
    : taille != null
      ? formatPoids(taille)
      : "Photo";

  return (
    <AttachmentViewer
      id={id}
      name={name}
      mimeType={mimeType}
      enAttente={!chargee}
      vignette={vignette}
      onCharge={() => setChargee(true)}
      className={cn(
        "block w-fit max-w-full cursor-pointer overflow-hidden rounded-(--rayon-sous-carte) border border-(--filet)",
        className,
      )}
    >
      {chargee ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/attachments/${id}/download?inline=1`}
          alt={name}
          className="max-h-[260px] max-w-[240px] object-cover"
        />
      ) : (
        <span className="relative block h-[168px] w-[136px] bg-(--fond-puce)">
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={apercu}
              alt=""
              aria-hidden
              className={cn(
                "absolute inset-0 size-full scale-110 object-cover blur-[5px]",
                indisponible && "opacity-50 grayscale",
              )}
            />
          ) : (
            <ImageSquare className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-(--gris-clair)" />
          )}
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11.5px] leading-[15px] font-medium text-white backdrop-blur-sm">
            {indisponible ? null : <DownloadSimple className="size-3" />}
            {mention}
          </span>
          <span className="sr-only">{name} — se charge à l’ouverture</span>
        </span>
      )}
    </AttachmentViewer>
  );
}
