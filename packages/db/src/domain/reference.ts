import type { Tx } from "../tenant";

// Génération de la référence lisible d'un Subject (SUB-00001). Recouvre a minima
// M12.1 — la séquence est dérivée du nombre de sujets existants du compte, à
// l'intérieur de la transaction de création. La contrainte @@unique([accountId,
// reference]) sert de garde-fou en cas de course (l'appelant retente).

const PREFIX = "SUB";
const PAD = 5;

export function formatSubjectReference(seq: number): string {
  return `${PREFIX}-${String(seq).padStart(PAD, "0")}`;
}

/**
 * Calcule la prochaine référence disponible pour le compte courant. À appeler
 * dans la transaction de création du Subject (le client tenant scope le count).
 */
export async function nextSubjectReference(db: Tx): Promise<string> {
  const count = await db.subject.count();
  return formatSubjectReference(count + 1);
}
