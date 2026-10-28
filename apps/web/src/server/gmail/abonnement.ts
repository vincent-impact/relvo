import { prisma } from "@/lib/db";
import { jetonDAcces } from "./acces";
import { abonner } from "./api";
import { doitRenouveler } from "./abonnement-regles";
import { donneesDeLaBoite, ecrireDonnees } from "./donnees";

// L'ABONNEMENT AUX CHANGEMENTS d'une boîte (M24.3) : `users.watch` publie sur
// notre sujet Pub/Sub, pour sept jours au plus. Posé à la connexion, renouvelé
// AU PASSAGE — par le webhook quand il reste moins de deux jours, par le cron
// du matin pour toute boîte Gmail — jamais par un troisième cron. Le dernier
// numéro d'historique retenu est celui du premier abonnement, puis celui que
// chaque lecture laisse : un renouvellement ne le touche pas, sinon ce qui est
// arrivé entre deux serait perdu.

export function sujetPubSub(): string | null {
  return process.env.GMAIL_PUBSUB_TOPIC || null;
}

export async function poserLAbonnement(
  externalAccountId: string,
): Promise<{ expireA: Date } | null> {
  const topic = sujetPubSub();
  if (!topic) {
    console.warn("[gmail] GMAIL_PUBSUB_TOPIC absent : pas d'abonnement", {
      externalAccountId,
    });
    return null;
  }
  const boite = await donneesDeLaBoite(externalAccountId);
  if (!boite) return null;
  const acces = await jetonDAcces(externalAccountId, boite);
  const res = await abonner(acces, topic);
  await ecrireDonnees(boite.channelId, {
    historyId: boite.donnees.historyId ?? res.historyId,
    watchExpireA: res.expireA.toISOString(),
  });
  return { expireA: res.expireA };
}

/** Toutes les boîtes Gmail actives dont l'abonnement manque ou expire bientôt. */
export async function renouvelerLesAbonnements(): Promise<{
  boites: number;
  renouvelees: number;
  echecs: number;
}> {
  const configs = await prisma.channelConfig.findMany({
    where: {
      provider: "gmail",
      externalAccountId: { not: null },
      status: { not: "disabled" },
    },
    select: { externalAccountId: true, connectionData: true },
  });
  const bilan = { boites: configs.length, renouvelees: 0, echecs: 0 };
  for (const c of configs) {
    const d = (c.connectionData ?? {}) as { watchExpireA?: string };
    if (!doitRenouveler(d.watchExpireA)) continue;
    try {
      if (await poserLAbonnement(c.externalAccountId!)) bilan.renouvelees += 1;
    } catch (err) {
      bilan.echecs += 1;
      console.error("[gmail] abonnement non renouvelé", {
        externalAccountId: c.externalAccountId,
        message: (err as Error).message,
      });
    }
  }
  return bilan;
}
