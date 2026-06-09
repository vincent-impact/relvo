import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import type { Account } from "@relvo/db";

// Helpers serveur d'accès au compte courant (M2.4). À utiliser dans les Server
// Components, Server Actions et Route Handlers pour récupérer le tenant et son
// client Prisma scellé. Toujours dériver l'account_id de la session — jamais
// d'un paramètre client (invariant n°1 : isolation tenant systématique).

/** Session brute Auth.js (mise en cache par requête). */
export const getSession = cache(async () => auth());

/** account_id du compte connecté, ou null si anonyme. */
export async function getCurrentAccountId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/** account_id du compte connecté ; redirige vers /connexion si anonyme. */
export async function requireAccountId(): Promise<string> {
  const accountId = await getCurrentAccountId();
  if (!accountId) redirect("/connexion");
  return accountId;
}

/** Compte courant complet, ou null si anonyme / introuvable. */
export const getCurrentAccount = cache(async (): Promise<Account | null> => {
  const accountId = await getCurrentAccountId();
  if (!accountId) return null;
  return prisma.account.findUnique({ where: { id: accountId } });
});

/** Compte courant complet ; redirige vers /connexion si absent. */
export async function requireAccount(): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) redirect("/connexion");
  return account;
}

/**
 * Client Prisma tenant-aware du compte connecté. Toute requête est filtrée /
 * estampillée par son account_id. Redirige vers /connexion si anonyme.
 */
export async function getTenantDb() {
  const accountId = await requireAccountId();
  return tenantDb(accountId);
}
