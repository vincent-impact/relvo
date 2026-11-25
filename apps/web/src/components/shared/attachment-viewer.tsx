"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { PieceEcran } from "@/components/shared/piece-ecran";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { adresseDeVignette } from "@/lib/medias";
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
//
// UNE PIÈCE GARDÉE EN RÉFÉRENCE (M25.3) n'est pas dans le stockage : c'est ce
// tap qui va la chercher chez le fournisseur du canal — la route attend, puis
// sert le fichier comme un autre. Pour une image, la visionneuse montre donc
// sa vignette et une attente le temps que l'original arrive (`enAttente`), et
// dit quand il n'arrivera pas. ⚠️ Rien ici ne charge la pièce AVANT le tap.

export function AttachmentViewer({
  id,
  name,
  mimeType,
  source = "attachment",
  enAttente = false,
  vignette,
  onCharge,
  className,
  children,
}: {
  id: string;
  name: string;
  mimeType?: string | null;
  /** Pièce jointe d'un message (défaut) ou connaissance d'un dossier. */
  source?: SourcePiece;
  /** La pièce n'est pas stockée : l'ouvrir va la chercher à la source (M25.3). */
  enAttente?: boolean;
  /** Sa vignette (JPEG, base64), montrée le temps que l'original arrive. */
  vignette?: string | null;
  /** L'original d'une image est arrivé : la pièce est désormais stockée. */
  onCharge?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const base = adresseDePiece(source, id);
  const url = `${base}/download?inline=1`;
  const genre = genreDePiece(name, mimeType);
  const [open, setOpen] = useState(false);
  // L'image d'une référence : en route, arrivée, ou perdue.
  const [image, setImage] = useState<"charge" | "prete" | "echec">("charge");
  // Le panneau tient la place de l'image tant qu'une référence arrive, et
  // quand une image — gardée ou non — ne peut pas s'afficher.
  const panneau = (enAttente && image === "charge") || image === "echec";
  const apercu = adresseDeVignette(vignette);

  function ouvrir(etat: boolean) {
    // Rouvrir retente : un échec n'est pas définitif (le réseau, la source).
    if (etat && image === "echec") setImage("charge");
    setOpen(etat);
  }

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
      <button type="button" onClick={() => ouvrir(true)} className={className}>
        {children}
      </button>
      {genre === "image" ? (
        <Dialog open={open} onOpenChange={ouvrir}>
          <DialogContent
            showCloseButton={false}
            className="w-auto max-w-[94vw] border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[94vw]"
          >
            {/* Requis pour l'accessibilité (base-ui), masqué visuellement. */}
            <DialogTitle className="sr-only">{name}</DialogTitle>
            {panneau ? (
              <div
                role={image === "echec" ? "alert" : "status"}
                className="relative grid h-[min(60vh,420px)] w-[min(78vw,320px)] place-items-center overflow-hidden rounded-2xl bg-black/70"
              >
                {apercu ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={apercu}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-md"
                  />
                ) : null}
                {image === "echec" ? (
                  <p className="relative max-w-[240px] px-4 text-center text-[14px] leading-5 font-normal text-white">
                    {enAttente
                      ? "Cette image n'a pas pu être récupérée. Relvo ne l'avait pas gardée ; elle est peut-être encore sur votre téléphone."
                      : "Cette image n'a pas pu être affichée."}
                  </p>
                ) : (
                  <span className="relative flex flex-col items-center gap-2.5 text-white">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-[14px] font-normal">
                      Récupération de l&apos;image…
                    </span>
                  </span>
                )}
              </div>
            ) : null}
            {/* Montée à l'ouverture seulement : c'est elle qui va chercher une
                pièce gardée en référence, et rien ne doit le faire avant le
                tap. */}
            {open && image !== "echec" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={name}
                onLoad={() => {
                  setImage("prete");
                  onCharge?.();
                }}
                onError={() => setImage("echec")}
                className={
                  panneau
                    ? "hidden"
                    : "max-h-[86vh] max-w-[94vw] rounded-2xl object-contain"
                }
              />
            ) : null}
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
