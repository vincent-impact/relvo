import "server-only";
import { redirect } from "next/navigation";
import { requireAccount } from "@/server/auth-context";
import type { Account } from "@relvo/db";

// Le garde de la zone d'administration (M21.1), côté serveur. Le proxy a déjà
// lu le rôle dans le jeton ; ici on le RELIT EN BASE : une rétrogradation prend
// effet au rendu suivant, sans attendre que le jeton expire. Appelé par le
// layout de la zone ET par chaque Server Action d'administration — une action
// n'a pas de chemin, le proxy ne la voit pas (PITFALLS #30).

export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  return account;
}
