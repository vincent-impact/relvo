"use server";

import { markWelcomeSeen } from "@relvo/db";
import type { ActionResult } from "@relvo/db";
import { connectEmailChannelAction } from "@/server/actions/email";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import type { MailProvider } from "@/server/unipile/client";

// La première connexion (01 §11, M19.9) : les diapositives se voient une
// fois, et la trace vit sur le compte — posée par le domaine, jamais par le
// navigateur. Deux sorties : « Plus tard » ramène à l'accueil ; une boîte
// choisie enchaîne sur la connexion ordinaire d'un canal, celle de la page des
// canaux — même fonction, même retour (`/canaux?connected=1`), où le guidage
// reprend.
//
// ⚠️ Aucune `redirect()` ici : le cache du routeur a mémorisé « / » comme une
// redirection vers /bienvenue (c'est par là que le compte est arrivé), et une
// navigation client y retomberait pendant `staleTimes.dynamic`. Le client fait
// une navigation COMPLÈTE (`window.location`), qui repart de zéro.

/** Les diapositives sont passées ou terminées sans connecter de boîte. */
export async function passerBienvenueAction(): Promise<{ ok: true }> {
  const accountId = await requireAccountId();
  const db = await getTenantDb();
  await markWelcomeSeen(db, accountId);
  return { ok: true };
}

/**
 * La boîte choisie sur la dernière diapositive : la trace est posée D'ABORD
 * — même si la connexion échoue chez le fournisseur, on ne remontre pas les
 * diapositives —, puis la connexion ordinaire démarre.
 */
export async function connecterPremiereBoiteAction(
  provider: MailProvider,
): Promise<ActionResult<{ url: string }>> {
  const accountId = await requireAccountId();
  const db = await getTenantDb();
  await markWelcomeSeen(db, accountId);
  return connectEmailChannelAction(provider);
}
