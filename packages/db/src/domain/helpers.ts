import { DomainError } from "./errors";

// Helpers partagés du domaine (M3.3).

/**
 * Vérifie qu'une mutation scopée par tenant (updateMany / deleteMany via le
 * client tenant) a bien touché exactement une ligne. Sinon la cible
 * n'appartient pas au compte ou n'existe pas → NOT_FOUND.
 *
 * Pattern d'usage (le `where` reçoit account_id via l'extension tenant) :
 *   const { count } = await tx.subject.updateMany({ where: { id }, data });
 *   ensureAffected(count, "Sujet");
 */
export function ensureAffected(count: number, label = "Ressource"): void {
  if (count !== 1) {
    throw new DomainError("NOT_FOUND", `${label} introuvable.`);
  }
}

/**
 * Données de création d'une entité tenant : on retire les champs gérés
 * automatiquement (id/timestamps) et `accountId` (injecté par l'extension
 * tenant au runtime). Le `create` Prisma typé exige toujours `accountId` ; les
 * fonctions de domaine castent donc leur `data` vers le type Prisma complet.
 */
export type TenantCreate<T> = Omit<
  T,
  "accountId" | "id" | "createdAt" | "updatedAt"
>;

/** Slug URL-safe à partir d'un libellé (accents retirés, espaces → tirets). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
