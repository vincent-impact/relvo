import {
  FileBlank,
  FilePdf,
  FileText,
  FileZip,
  FilmStrip,
  ImageSquare,
  PresentationChart,
  Table,
  Waveform,
  type Picto,
} from "@/components/shared/picto";
import { familleDeFichier, type FamilleFichier } from "@/lib/pieces";
import { cn } from "@/lib/utils";

// L'icône d'un fichier, partout où il se montre — carte d'une pièce dans une
// conversation, ligne de document, ligne de connaissance, écran du fichier.
// Elle dit le TYPE avant qu'on lise le nom : une forme par famille, et pour les
// quatre que tout le monde reconnaît à leur couleur — PDF rouge, classeur vert,
// document bleu, présentation orange — la couleur qui va avec. Le reste (image,
// son, vidéo, archive, inconnu) garde le gris : la forme suffit, et un
// arc-en-ciel n'apprendrait plus rien.

const FAMILLES: Record<
  FamilleFichier,
  { icone: Picto; couleur: string | null }
> = {
  pdf: { icone: FilePdf, couleur: "var(--fichier-pdf)" },
  tableur: { icone: Table, couleur: "var(--fichier-tableur)" },
  document: { icone: FileText, couleur: "var(--fichier-document)" },
  presentation: {
    icone: PresentationChart,
    couleur: "var(--fichier-presentation)",
  },
  image: { icone: ImageSquare, couleur: null },
  son: { icone: Waveform, couleur: null },
  video: { icone: FilmStrip, couleur: null },
  archive: { icone: FileZip, couleur: null },
  autre: { icone: FileBlank, couleur: null },
};

const TAILLES = {
  /** La carte d'une pièce dans un message. */
  sm: {
    puce: "size-[30px] rounded-(--rayon-bouton-ciel)",
    icone: "size-[17px]",
  },
  /** Une ligne de liste : documents d'un sujet, connaissances d'un dossier. */
  md: {
    puce: "size-[34px] rounded-(--rayon-bouton-ciel)",
    icone: "size-[19px]",
  },
  /** L'écran du fichier. */
  lg: { puce: "size-[72px] rounded-(--rayon-carte)", icone: "size-9" },
} as const;

export function PieceIcone({
  name,
  mimeType,
  size = "md",
  className,
}: {
  name: string;
  mimeType?: string | null;
  size?: keyof typeof TAILLES;
  className?: string;
}) {
  const { icone: Icone, couleur } = FAMILLES[familleDeFichier(name, mimeType)];
  const taille = TAILLES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "grid flex-none place-items-center",
        taille.puce,
        !couleur && "bg-(--fond-puce) text-gris",
        className,
      )}
      style={
        couleur
          ? {
              color: couleur,
              // Le fond est la même couleur, très éclaircie : la puce se lit
              // comme un objet d'une seule teinte, sans seconde valeur à tenir.
              backgroundColor: `color-mix(in oklch, ${couleur} 11%, var(--blanc))`,
            }
          : undefined
      }
    >
      <Icone className={taille.icone} />
    </span>
  );
}
