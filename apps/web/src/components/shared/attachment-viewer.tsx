"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// Visualiseur de pièce jointe, adapté au mobile/PWA (M5.4).
//
// Différencié par type de fichier, car on ne les affiche pas pareil :
//   • IMAGE  → lightbox plein écran IN-APP (overlay sombre, tap dehors = ferme,
//     pinch-zoom natif). On NE quitte PAS l'app — `target="_blank"` éjecterait
//     vers Safari en PWA iOS.
//   • PDF / autre → ouverture NAVIGATEUR (`?inline=1`), qui rend les PDF
//     nativement bien, là où un rendu embarqué est cassé en PWA iOS.
//
// L'enfant est la carte visuelle (mêmes styles qu'avant) ; ce composant ne fait
// qu'envelopper le geste. L'URL `?inline=1` est stable (redirection R2).

export function AttachmentViewer({
  id,
  name,
  mimeType,
  className,
  children,
}: {
  id: string;
  name: string;
  mimeType?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const url = `/api/attachments/${id}/download?inline=1`;
  const isImage = (mimeType ?? "").startsWith("image/");
  const [open, setOpen] = useState(false);

  if (!isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-auto max-w-[94vw] border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[94vw]"
        >
          {/* Requis pour l'accessibilité (base-ui), masqué visuellement. */}
          <DialogTitle className="sr-only">{name}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="max-h-[86vh] max-w-[94vw] rounded-2xl object-contain"
          />
          <DialogClose
            aria-label="Fermer"
            className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
          >
            <X className="size-5" strokeWidth={2.4} />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
