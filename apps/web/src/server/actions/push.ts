"use server";

import { revalidatePath } from "next/cache";
import {
  err,
  pushSubscriptionSchema,
  removePushSubscription,
  savePushSubscription,
  type PushSubscriptionInput,
} from "@relvo/db";
import { domainAction } from "@/lib/action-result";
import { requireAccountId } from "@/server/auth-context";
import { envoyerNotification } from "@/server/push/envoyer";
import { BIENVENUE } from "@/server/push/regles";

// Les notifications (M12.7, M12.9) — l'abonnement d'un appareil, enregistré et
// retiré depuis la ligne « Notifications » des Préférences. Le compte vient de
// la session ; l'abonnement vient du navigateur, validé à la frontière.

/**
 * Enregistre l'abonnement de cet appareil. Un appareil NOUVEAU reçoit aussitôt
 * la notification de bienvenue : la preuve que la chaîne marche, au moment où
 * l'utilisateur regarde. Un appareil déjà connu (clés rafraîchies au
 * chargement) ne reçoit rien.
 */
export async function abonnerPushAction(input: PushSubscriptionInput) {
  const accountId = await requireAccountId();
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return err("validation", "Abonnement illisible.");
  const result = await domainAction((db) =>
    savePushSubscription(db, accountId, parsed.data),
  );
  console.info("[push] abonnement", {
    accountId,
    ok: result.ok,
    created: result.ok ? result.data.created : undefined,
  });
  if (result.ok && result.data.created) {
    // L'abonnement est acquis quoi qu'il arrive à la bienvenue : un envoi qui
    // échoue se lit dans les logs, il ne défait pas le réglage.
    try {
      await envoyerNotification(accountId, BIENVENUE);
    } catch (err) {
      console.error("[push] bienvenue en échec", { accountId, err });
    }
    revalidatePath("/preferences");
  }
  return result;
}

/** Coupe les notifications sur cet appareil : la ligne tombe, rien d'autre ne change. */
export async function desabonnerPushAction(endpoint: string) {
  const accountId = await requireAccountId();
  const result = await domainAction((db) =>
    removePushSubscription(db, accountId, String(endpoint), "utilisateur"),
  );
  console.info("[push] désabonnement", { accountId, ok: result.ok });
  if (result.ok) revalidatePath("/preferences");
  return result;
}
