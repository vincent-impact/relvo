// Les ERREURS de l'échange, en langage client (M10.15) — pures, tenues par un
// test. Le texte du dirigeant n'est jamais perdu : il reste dans le composer,
// et le fil dit quoi faire. Rien de technique ne traverse : ni code, ni
// trace, ni nom de fournisseur.

export type ErreurEchange = {
  phrase: string;
  /** Un lien de sortie quand le geste n'est pas « réessayer ». */
  lien?: { href: string; label: string };
  reessayer: boolean;
};

export const ERREUR_GENERIQUE: ErreurEchange = {
  phrase: "Je n’ai pas pu répondre. Réessayez dans un instant.",
  reessayer: true,
};

/** La phrase du fil pour une erreur du hook ou de la route. */
export function phraseErreur(
  message: string | null | undefined,
): ErreurEchange {
  const m = (message ?? "").toLowerCase();
  if (!m) return ERREUR_GENERIQUE;
  if (m.includes("non authentifi") || /\b401\b/.test(m)) {
    return {
      phrase:
        "Votre session a expiré. Reconnectez-vous pour reprendre l’échange.",
      lien: {
        href: "/connexion?callbackUrl=%2Frelvo",
        label: "Se reconnecter",
      },
      reessayer: false,
    };
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("offline")
  ) {
    return {
      phrase:
        "Pas de réseau pour l’instant. Réessayez dès que vous êtes connecté.",
      reessayer: true,
    };
  }
  if (m.includes("trop long")) {
    return {
      phrase:
        "Cet échange est devenu trop long pour moi. Commencez-en un nouveau, je vous suis.",
      lien: { href: "/relvo?nouveau=1", label: "Nouvel échange" },
      reessayer: false,
    };
  }
  if (/\b(429|rate limit|surcharg|trop de demandes)\b/.test(m)) {
    return {
      phrase: "Je suis très sollicité en ce moment. Réessayez dans une minute.",
      reessayer: true,
    };
  }
  // Une phrase déjà en langage client (la route en envoie) passe telle quelle.
  if (
    /^[A-ZÉÈÀÇ]/.test((message ?? "").trim()) &&
    !/[{}<>]/.test(m) &&
    m.length < 160
  ) {
    return { phrase: (message ?? "").trim(), reessayer: true };
  }
  return ERREUR_GENERIQUE;
}

/** Ce que le fil dit quand un tour s'est arrêté avant la fin. */
export function phraseArret(arret: "plafond" | "longueur"): string {
  return arret === "plafond"
    ? "Je m’arrête là pour ce tour : demandez-moi la suite."
    : "Ma réponse devenait trop longue, je me suis arrêté. Demandez-moi la suite.";
}
