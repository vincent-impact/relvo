// La PAGE DE RETOUR d'une connexion de boîte (M5, M13.2, M24.2) : d'où
// l'utilisateur est parti vers le fournisseur — la page des canaux, ou
// l'échange avec Relvo quand c'est la prise en main qui demande la boîte (05
// §11.11) — et ce qu'on lui dit en revenant : `connected=1` (la page se
// rafraîchit jusqu'à voir la lecture), ou `erreur=<motif>` (la page le dit).
// Le même vocabulaire pour l'agrégateur et pour le relais Gmail.

export type RetourConnexion = "canaux" | "relvo";

const RETOURS: Record<RetourConnexion, string> = {
  canaux: "/canaux",
  relvo: "/relvo?from=%2F",
};

/** Les motifs d'un retour en échec, tels que la page les dit. */
export const MOTIFS_DE_RETOUR = {
  refus: "Vous n’avez pas autorisé Relvo : la boîte n’est pas reliée.",
  perimetres:
    "Relvo a besoin de lire la boîte et d’y répondre : cochez les deux autorisations proposées par Google.",
  "deja-reliee": "Cette boîte est déjà reliée à Relvo.",
  "autre-boite":
    "Ce n’est pas la même boîte : reconnectez celle de ce canal, ou reliez l’autre à part.",
  google: "Google n’a pas répondu. Réessayez dans un instant.",
  perdu: "La connexion a expiré en route. Recommencez depuis le bouton.",
  fournisseur: "La connexion de la boîte a échoué.",
} as const;
export type MotifDeRetour = keyof typeof MOTIFS_DE_RETOUR;

export function estUnMotifDeRetour(v: unknown): v is MotifDeRetour {
  return typeof v === "string" && v in MOTIFS_DE_RETOUR;
}

export function pageDeRetour(
  retour: RetourConnexion,
  resultat: { connected: true } | { erreur: MotifDeRetour },
): string {
  const page = RETOURS[retour];
  const sep = page.includes("?") ? "&" : "?";
  return "connected" in resultat
    ? `${page}${sep}connected=1`
    : `${page}${sep}erreur=${resultat.erreur}`;
}
