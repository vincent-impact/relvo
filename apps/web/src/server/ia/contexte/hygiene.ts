// Hygiène du message (M7.3, `05 §10.1`) — LA PREMIÈRE OPTIMISATION, en coût
// comme en qualité : un fil cité trois fois fait confondre au modèle qui a dit
// quoi et quand, et chaque ligne citée est facturée.
//
// Trois opérations, dans cet ordre : retirer les citations de réponse, retirer
// la signature, plafonner la longueur. Toutes déterministes, toutes prudentes :
// dans le doute, on garde — un message amputé coûte plus cher qu'un message
// long.

/** Plafond par message, en caractères (~1 100 jetons). Le pipeline pousse tout. */
export const PLAFOND_MESSAGE = 4_000;

/** Lignes d'en-tête de citation, français et anglais, clients courants. */
const DEBUT_CITATION: readonly RegExp[] = [
  /^Le .{6,80} a écrit ?:\s*$/m,
  /^On .{6,80} wrote:\s*$/m,
  /^-{2,}\s*(Message d'origine|Original Message|Message transféré|Forwarded message)\s*-{2,}\s*$/im,
  /^De ?: .+\n(Envoyé|Date) ?: .+\n(À|To) ?: .+/m,
  /^From: .+\n(Sent|Date): .+\nTo: .+/m,
  /^_{10,}\s*$/m,
];

/** Formules qui ouvrent une signature — la ligne et tout ce qui suit. */
const DEBUT_SIGNATURE: readonly RegExp[] = [
  /^-- ?$/m,
  /^(Bien |Très )?[Cc]ordialement,?\s*$/m,
  /^(Bien à vous|Bien à toi|Belle journée|Bonne journée|Bonne réception|Merci d'avance|Salutations distinguées|Sincères salutations|Amicalement|Best regards|Kind regards|Regards|Sincerely),?\s*$/m,
  /^Envoyé (de|depuis) mon (iPhone|iPad|Android|smartphone|mobile).*$/m,
  /^Sent from my .+$/m,
];

/** Retire les citations de réponse : tout ce qui suit un en-tête de citation, et les lignes « > ». */
export function retirerCitations(texte: string): string {
  let t = texte;
  let coupe = t.length;
  for (const re of DEBUT_CITATION) {
    const m = re.exec(t);
    if (m && m.index < coupe) coupe = m.index;
  }
  t = t.slice(0, coupe);
  return t
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

/**
 * Retire la signature : à partir de la première formule de politesse finale,
 * à condition qu'elle soit dans la seconde moitié du message — une formule en
 * tête (« Bonjour, cordialement ») n'est pas une signature.
 */
export function retirerSignature(texte: string): string {
  let coupe = texte.length;
  for (const re of DEBUT_SIGNATURE) {
    const m = re.exec(texte);
    if (m && m.index >= texte.length / 2 && m.index < coupe) coupe = m.index;
  }
  return texte.slice(0, coupe);
}

/** Normalise les blancs : fins de ligne, espaces en fin de ligne, lignes vides en série. */
export function normaliserBlancs(texte: string): string {
  return texte
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plafonne, en coupant sur une fin de ligne quand c'est possible, avec un marqueur explicite. */
export function plafonner(texte: string, plafond = PLAFOND_MESSAGE): string {
  if (texte.length <= plafond) return texte;
  const tete = texte.slice(0, plafond);
  const derniereLigne = tete.lastIndexOf("\n");
  const coupe = derniereLigne > plafond * 0.7 ? derniereLigne : plafond;
  return `${texte.slice(0, coupe).trimEnd()}\n[… message tronqué à ${plafond} caractères]`;
}

/** Les trois opérations, dans l'ordre. Idempotente. */
export function nettoyerMessage(
  contenu: string,
  plafond = PLAFOND_MESSAGE,
): string {
  return plafonner(
    normaliserBlancs(retirerSignature(retirerCitations(contenu))),
    plafond,
  );
}
