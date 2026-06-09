import { prisma } from "@/lib/db";
import { type Account, AccountRole } from "@relvo/db";

// Logique métier de création de compte (M2.6). Pure (pas de "use server") :
// appelée à la fois par l'action de signup Credentials et par le callback
// signIn de Google dans auth.ts.

type CreateAccountInput = {
  email: string;
  firstName: string;
  lastName: string;
  /** Hash bcrypt — absent pour un compte créé via Google OAuth. */
  passwordHash?: string | null;
  googleId?: string | null;
  image?: string | null;
  /** Date de vérification email — renseignée d'emblée pour Google. */
  emailVerified?: Date | null;
  role?: AccountRole;
};

/**
 * Crée un Account et, dans la même transaction, le Folder « Général »
 * (`is_default`, documentaire transversal — invariant n°17) ainsi qu'un
 * EventLog `account_created`. L'email est supposé déjà normalisé (cf.
 * emailSchema) et son unicité vérifiée par l'appelant.
 */
export async function createAccount(
  input: CreateAccountInput,
): Promise<Account> {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: input.passwordHash ?? null,
        googleId: input.googleId ?? null,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? null,
        role: input.role ?? AccountRole.ceo,
      },
    });

    // Folder « Général » auto-créé : bac documentaire transversal, jamais de
    // Subject (invariant n°17). Un seul is_default par compte.
    await tx.folder.create({
      data: {
        accountId: account.id,
        name: "Général",
        slug: "general",
        description:
          "Connaissances transversales chargées dans le contexte de tous les sujets.",
        isDefault: true,
      },
    });

    await tx.eventLog.create({
      data: {
        accountId: account.id,
        entityType: "system",
        entityId: account.id,
        eventType: "account_created",
        title: "Compte créé",
        actor: "system",
        metadata: {
          via: input.googleId ? "google" : "credentials",
        },
      },
    });

    return account;
  });
}
