import bcrypt from "bcryptjs";

// Coût bcrypt : 12 tours = bon compromis sécurité/latence en 2026.
const BCRYPT_ROUNDS = 12;

/** Hache un mot de passe en clair pour stockage dans Account.passwordHash. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compare un mot de passe en clair au hash stocké. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
