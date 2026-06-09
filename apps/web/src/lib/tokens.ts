import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { VerificationTokenType } from "@relvo/db";

// Jetons à usage unique pour la vérification d'email et le reset de mot de passe.
// Stockés dans verification_tokens, indexés par `identifier` (= email cible).

const TTL_MS: Record<VerificationTokenType, number> = {
  [VerificationTokenType.email_verification]: 24 * 60 * 60 * 1000, // 24 h
  [VerificationTokenType.password_reset]: 60 * 60 * 1000, // 1 h
};

/**
 * Crée un jeton (et invalide les précédents du même type pour cet email, pour
 * qu'un seul lien soit valide à la fois). Retourne le jeton en clair à insérer
 * dans l'URL de l'email.
 */
export async function createVerificationToken(
  identifier: string,
  type: VerificationTokenType,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TTL_MS[type]);

  await prisma.verificationToken.deleteMany({ where: { identifier, type } });
  await prisma.verificationToken.create({
    data: { identifier, token, type, expires },
  });

  return token;
}

/**
 * Consomme un jeton : le supprime (usage unique) et retourne l'email cible
 * s'il est valide et non expiré, sinon null.
 */
export async function consumeVerificationToken(
  token: string,
  type: VerificationTokenType,
): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row || row.type !== type) return null;

  await prisma.verificationToken.delete({ where: { token } });

  if (row.expires.getTime() < Date.now()) return null;
  return row.identifier;
}
