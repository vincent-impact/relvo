// LES RÈGLES DE LA DICTÉE côté appareil (M22.2, M22.3) — pures, tenues par
// `test/dictee.test.ts`. Les phrases sont celles tranchées avec le dirigeant
// (`backlog/sprints/2026-10-m22-voix.md`) ; celles que la route envoie
// (assistant coupé, inférence absente) arrivent toutes faites et passent
// telles quelles. Rien de technique ne traverse : ni code, ni trace.

export const PHRASES_DICTEE = {
  /** Le fournisseur n'a rien compris, ou le texte est vide. */
  incompris: "Je n'ai pas compris. Réessayez.",
  /** `getUserMedia` refusé. */
  permission:
    "Relvo n'a pas accès au micro. Autorisez-le dans les réglages de votre téléphone.",
  /** L'enregistrement s'est terminé sous la durée minimale. */
  tropCourt: "L'enregistrement s'est arrêté. Réessayez.",
  /** Au-delà de la durée ou de la taille maximale (l'appareil s'arrête avant ; la route le redit). */
  tropLong: "La dictée est trop longue. Réessayez en une minute au plus.",
  /** Le réseau. */
  reseau: "Pas de réseau pour l'instant. Réessayez dès que vous êtes connecté.",
  /** Pendant la transcription. */
  ecoute: "Relvo écoute…",
  /** Le texte est posé dans le champ. */
  pose: "Dicté — relisez avant d'envoyer",
  /** Le compteur, pendant l'enregistrement. */
  enregistre: "Appuyez pour finir",
} as const;

export type ErreurDictee =
  | "permission"
  | "trop-court"
  | "trop-long"
  | "reseau"
  | "incompris"
  /** La route a répondu par une phrase (assistant coupé, inférence absente). */
  | "serveur";

/** La phrase du composer pour une erreur de l'appareil ou de la route. */
export function phraseDictee(
  erreur: ErreurDictee,
  messageServeur?: string | null,
): string {
  switch (erreur) {
    case "permission":
      return PHRASES_DICTEE.permission;
    case "trop-court":
      return PHRASES_DICTEE.tropCourt;
    case "trop-long":
      return PHRASES_DICTEE.tropLong;
    case "reseau":
      return PHRASES_DICTEE.reseau;
    case "serveur":
      return messageServeur?.trim() || PHRASES_DICTEE.incompris;
    default:
      return PHRASES_DICTEE.incompris;
  }
}

/** `mm:ss`, pour le compteur. */
export function formatDuree(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * La transcription S'AJOUTE au texte déjà saisi, elle ne le remplace pas
 * (tranché) : séparée d'une espace, ou d'un saut de ligne si le texte finit
 * une phrase. Un champ vide reçoit le texte tel quel.
 */
export function ajouterDictee(texteSaisi: string, dictee: string): string {
  const avant = texteSaisi.replace(/\s+$/, "");
  const ajout = dictee.trim();
  if (!ajout) return texteSaisi;
  if (!avant) return ajout;
  const separateur = /[.!?…]$/.test(avant) ? "\n" : " ";
  return `${avant}${separateur}${ajout}`;
}

/**
 * Le type MIME que `MediaRecorder` acceptera, dans l'ordre où Relvo les
 * préfère (iOS ne donne que `audio/mp4`). Null : pas de dictée sur cet
 * appareil, le disque ne s'affiche pas — un bouton sans effet se retire.
 */
export function typeAudioSupporte(
  candidats: readonly string[],
  isTypeSupported: (type: string) => boolean,
): string | null {
  for (const t of candidats) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      // Un navigateur sans `isTypeSupported` : on passe au suivant.
    }
  }
  return null;
}

/** L'extension d'un fichier d'enregistrement, pour la feuille de partage. */
export function extensionAudio(mimeType: string): string {
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  if (mimeType.startsWith("audio/webm")) return "webm";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  if (mimeType.startsWith("audio/wav")) return "wav";
  return "bin";
}
