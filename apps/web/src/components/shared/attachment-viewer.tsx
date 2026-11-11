"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PieceEcran } from "@/components/shared/piece-ecran";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { adresseDePiece, genreDePiece, type SourcePiece } from "@/lib/pieces";

// Visualiseur de pièce, adapté au mobile/PWA (M5.4, recette R18) — LE geste
// d'ouverture, partout où une pièce se touche : conversation, détail d'un
// message, documents d'un sujet, connaissances d'un dossier.
//
// Un tap ouvre, sans étape entre les deux, selon ce que la pièce est
// (`genreDePiece`) :
//   • IMAGE    → visionneuse plein écran DANS l'application (overlay sombre, tap
//     dehors = ferme, pinch-zoom natif) ;
//   • PDF      → le lecteur du navigateur (`?inline=1`), qui rend les PDF
//     nativement bien, là où un rendu embarqué est cassé en PWA iOS ;
//   • CLASSEUR → aperçu du tableau dans l'application (`PieceEcran`) ;
//   • AUTRE    → l'écran du fichier : nom, type, poids, « Ouvrir avec… »,
//     « Télécharger » (`PieceEcran`).
//
// ⚠️ Le navigateur n'est une issue QUE pour ce qu'il sait afficher. Y envoyer
// un classeur ouvrait, en application installée sur iPhone, un volet sur une
// page blanche — et Relvo restait blanc au retour.
//
// L'enfant est la carte visuelle ; ce composant n'enveloppe que le geste.
// L'URL `?inline=1` est stable (redirection vers le stockage).

export function AttachmentViewer({
  id,
  name,
  mimeType,
  source = "attachment",
  className,
  children,
}: {
  id: string;
  name: string;
  mimeType?: string | null;
  /** Pièce jointe d'un message (défaut) ou connaissance d'un dossier. */
  source?: SourcePiece;
  className?: string;
  children: React.ReactNode;
}) {
  const base = adresseDePiece(source, id);
  const url = `${base}/download?inline=1`;
  const genre = genreDePiece(name, mimeType);
  const [open, setOpen] = useState(false);

  if (genre === "pdf") {
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
      {genre === "image" ? (
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
      ) : (
        <PieceEcran
          open={open}
          onOpenChange={setOpen}
          base={base}
          name={name}
          mimeType={mimeType ?? null}
          genre={genre}
        />
      )}
    </>
  );
}
