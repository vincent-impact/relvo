"use server";

import { markWelcomeSeen } from "@relvo/db";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

// La première connexion (01 §11, M19.9) : les diapositives se voient une
// fois, et la trace vit sur le compte — posée par le domaine, jamais par le
// navigateur. Deux sorties, la même trace : « Configurer Relvo » ouvre
// l'échange, où la prise en main commence (05 §11.11) ; « Plus tard » ramène
// à l'accueil. La boîte ne se demande plus ici : c'est la dernière étape de
// l'échange.
//
// ⚠️ Aucune `redirect()` ici : le cache du routeur a mémorisé « / » comme une
// redirection vers /bienvenue (c'est par là que le compte est arrivé), et une
// navigation client y retomberait pendant `staleTimes.dynamic`. Le client fait
// une navigation COMPLÈTE (`window.location`), qui repart de zéro.

/** Les diapositives sont terminées ou passées : la trace est posée. */
export async function passerBienvenueAction(): Promise<{ ok: true }> {
  const accountId = await requireAccountId();
  const db = await getTenantDb();
  await markWelcomeSeen(db, accountId);
  return { ok: true };
}
