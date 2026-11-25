// LA POLITIQUE DES MÉDIAS (M25.3, M25.5) — « décider avant de télécharger ».
// Module PUR : ce qu'on sait d'une pièce de messagerie avant d'en lire un
// octet, et ce que Relvo en fait.
//
// Le principe (`conception/04` §11) : Relvo garde en plein format ce qu'un
// sujet porte ; le reste se relit à la source. À la réception d'un message de
// messagerie, chaque pièce reçoit donc une de trois décisions :
//
//   stocker   → téléchargée tout de suite, comme avant ;
//   reference → la ligne est créée (nom, type, poids annoncé, vignette), le
//               fichier reste chez le fournisseur ; il se télécharge quand on
//               l'ouvre, ou quand un sujet prend le message ;
//   trace     → rien à aller chercher, jamais : un autocollant, un GIF. Le fil
//               dit seulement qu'il y en avait un.
//
// L'E-MAIL n'est pas concerné : une pièce d'e-mail est un document, elle se
// stocke toujours — sauf ses images INCORPORÉES (logo de signature, pixel de
// suivi), qui ne sont pas des pièces (`estUneImageIncorporee`).

const MO = 1024 * 1024;

export const MEDIAS = {
  /**
   * Le poids au-delà duquel une pièce ne se stocke pas D'ELLE-MÊME, par
   * famille — à la réception comme à la complétion d'un sujet. Au-delà, elle
   * reste une référence, qui s'ouvre à la demande.
   */
  plafonds: {
    image: 10 * MO,
    audio: 5 * MO,
    video: 64 * MO,
    autre: 20 * MO,
  },
  /**
   * Une image incorporée d'e-mail plus légère que ceci n'est pas une pièce
   * jointe : un logo, un pictogramme, un pixel. Au-dessus, c'est une image
   * collée dans le corps par son auteur — elle se garde.
   */
  incorporeeMaxOctets: 150 * 1024,
} as const;

export type FamilleDeMedia = keyof typeof MEDIAS.plafonds;

/** La famille d'une pièce d'après son type MIME — ce que les plafonds distinguent. */
export function familleDeMedia(
  mime: string | null | undefined,
): FamilleDeMedia {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  return "autre";
}

/** Une pièce de messagerie telle que le fournisseur la décrit, avant tout téléchargement. */
export type PieceDeMessagerie = {
  /** Son identifiant chez le fournisseur : avec celui du message, il la relit. */
  id: string;
  famille: FamilleDeMedia;
  mime: string | null;
  /** Le nom montré : celui du fichier s'il en a un, sinon dit par son type. */
  nom: string;
  /** Le poids annoncé, en octets ; `null` quand le fournisseur ne le dit pas. */
  taille: number | null;
  autocollant: boolean;
  gif: boolean;
  /** Un message vocal, pas un fichier son. */
  vocal: boolean;
  /** La vignette que le réseau joint au message (JPEG, base64). */
  vignette: string | null;
};

export type DecisionDePiece = "stocker" | "reference" | "trace";

/**
 * Ce que Relvo fait d'une pièce de messagerie à la réception.
 *
 *   · Autocollant, GIF → trace. Jamais stockés, jamais relus.
 *   · Message vocal → stocké, sujet ou pas (petit, et c'est lui que Relvo
 *     transcrira), sous son plafond.
 *   · Tout le reste — photo, vidéo, document — → stocké seulement si un SUJET
 *     porte le message, et sous le plafond de sa famille. Sinon référence.
 *
 * Un poids inconnu ne retient pas : la pièce se télécharge et se pèse alors.
 */
export function deciderDeLaPiece(
  piece: Pick<
    PieceDeMessagerie,
    "famille" | "taille" | "autocollant" | "gif" | "vocal"
  >,
  contexte: { porteeParUnSujet: boolean },
): DecisionDePiece {
  if (piece.autocollant || piece.gif) return "trace";
  const sousLePlafond =
    piece.taille == null || piece.taille <= MEDIAS.plafonds[piece.famille];
  if (!sousLePlafond) return "reference";
  if (piece.vocal) return "stocker";
  return contexte.porteeParUnSujet ? "stocker" : "reference";
}

/**
 * Une image INCORPORÉE dans le corps d'un e-mail — elle porte un identifiant
 * de contenu, le corps la cite — et assez légère pour n'être qu'un logo de
 * signature ou un pixel de suivi : ce n'est pas une pièce jointe, Relvo ne la
 * stocke pas. Une image incorporée dont le poids n'est pas dit est laissée
 * aussi : le doute ne profite pas au logo.
 */
export function estUneImageIncorporee(piece: {
  mime: string | null;
  size: number | null;
  incorporee?: boolean;
}): boolean {
  if (!piece.incorporee) return false;
  if (familleDeMedia(piece.mime) !== "image") return false;
  return piece.size == null || piece.size <= MEDIAS.incorporeeMaxOctets;
}

/**
 * Une vignette tient en quelques kilo-octets ; au-delà, ce n'en est pas une,
 * et le domaine la refuserait (`createAttachmentSchema`, même borne).
 */
export const VIGNETTE_MAX_CARACTERES = 40_000;

/** L'adresse d'une vignette, prête pour un `src` — elle est petite, elle voyage dans la page. */
export function adresseDeVignette(vignette: string | null | undefined) {
  return vignette ? `data:image/jpeg;base64,${vignette}` : null;
}
