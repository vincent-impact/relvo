// Les règles PURES du backoffice (M21.4) — ce qu'un administrateur ne peut pas
// faire, décidé sans base ni session, donc testé sans l'une ni l'autre
// (`test/admin-regles.test.ts`). Les actions serveur les appellent AVANT la
// méthode du domaine ; la méthode, elle, ne connaît que la suppression.
//
// Module sans import : `@relvo/db` instancie le client Prisma à l'import, et
// ce fichier doit rester chargeable par un test unitaire.

export type RefusSuppression =
  | "soi_meme"
  | "compte_demonstration"
  | "email_different";

/**
 * Peut-on supprimer ce compte ? `null` = oui ; sinon la raison du refus.
 * - On ne scie pas la branche : l'administrateur ne supprime pas son compte.
 * - Le compte de démonstration est recréé à chaque build (`seed:ensure`) : le
 *   geste juste est « Réinitialiser », sur son profil.
 * - L'e-mail retapé doit être celui du compte, à la casse et aux espaces près :
 *   c'est la confirmation, pas une formalité.
 */
export function refusSuppression(input: {
  cibleId: string;
  cibleEmail: string;
  adminId: string;
  demoId: string;
  emailSaisi: string;
}): RefusSuppression | null {
  if (input.cibleId === input.adminId) return "soi_meme";
  if (input.cibleId === input.demoId) return "compte_demonstration";
  if (normaliser(input.emailSaisi) !== normaliser(input.cibleEmail)) {
    return "email_different";
  }
  return null;
}

export const MESSAGES_REFUS: Record<RefusSuppression, string> = {
  soi_meme: "Vous ne pouvez pas supprimer votre propre compte.",
  compte_demonstration:
    "Le compte de démonstration ne se supprime pas : réinitialisez-le depuis son profil.",
  email_different: "L'adresse saisie ne correspond pas à celle du compte.",
};

function normaliser(email: string): string {
  return email.trim().toLowerCase();
}
