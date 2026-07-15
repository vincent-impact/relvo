"use server";

import { DEMO_EMAIL, seedDemoAccount } from "@relvo/db";
import { getStorage } from "@relvo/storage";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/server/auth-context";
import { revalidateTenantData } from "@/server/cached";

// Reset du compte de démonstration (même effet que `pnpm db:seed`) — pour les
// béta-testeurs qui veulent repartir de données neuves. Réservé au compte démo :
// le seed ne touche QUE ce compte (par id/email), et on refuse l'appel pour tout
// autre compte par sécurité.

export async function resetDemoAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const account = await requireAccount();
  if (account.email !== DEMO_EMAIL) {
    return {
      ok: false,
      message: "Réinitialisation réservée au compte de démonstration.",
    };
  }
  // Le stockage purge le préfixe du compte (ce que la cascade PostgreSQL laisse
  // derrière elle) puis repousse les fixtures : un béta-testeur qui réinitialise
  // retrouve des documents réellement ouvrables, et ses propres uploads sont
  // nettoyés du bucket (M4.6).
  await seedDemoAccount(getStorage());
  revalidatePath("/", "layout"); // rafraîchit toutes les vues sur données neuves
  revalidateTenantData(); // purge le cache de données (reseed complet)
  return { ok: true };
}
