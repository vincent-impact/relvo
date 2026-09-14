"use server";

import { revalidatePath } from "next/cache";
import { setAssistantEnabled } from "@relvo/db";
import { domainAction } from "@/lib/action-result";
import { requireAccountId } from "@/server/auth-context";

// Préférences du compte (Réglages › Préférences). L'identifiant du compte
// vient de la session, jamais du client : un utilisateur ne règle que le sien.

/** Active ou coupe l'assistant Relvo sur le compte connecté. */
export async function setAssistantEnabledAction(enabled: boolean) {
  const accountId = await requireAccountId();
  const result = await domainAction((db) =>
    setAssistantEnabled(db, accountId, Boolean(enabled)),
  );
  if (result.ok) revalidatePath("/parametres");
  return result;
}
