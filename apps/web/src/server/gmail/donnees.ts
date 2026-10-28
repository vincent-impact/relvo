import { Prisma } from "@relvo/db";
import { prisma } from "@/lib/db";
import type { DonneesGmail } from "./jetons";

// CE QUE LE RELAIS SAIT D'UNE BOÎTE (M24.3), lu hors tenant par son adresse —
// `externalAccountId`, unique tous comptes confondus, la clé de résolution d'une
// notification qui arrive sans session, comme pour l'agrégateur. L'écriture
// est une écriture d'infrastructure, scopée par le canal (unique) : un jeton
// rafraîchi, un numéro d'historique, une échéance d'abonnement — rien que le
// domaine ait à journaliser.

export type BoiteGmail = {
  accountId: string;
  channelId: string;
  externalAccountId: string;
  status: string;
  /** L'adresse de la boîte et celle du compte : nos adresses. */
  nosAdresses: readonly (string | null | undefined)[];
  donnees: Partial<DonneesGmail>;
  connectionData: Record<string, unknown>;
};

export async function donneesDeLaBoite(
  externalAccountId: string,
): Promise<BoiteGmail | null> {
  const config = await prisma.channelConfig.findUnique({
    where: { externalAccountId },
    select: {
      accountId: true,
      channelId: true,
      provider: true,
      status: true,
      connectionData: true,
      channel: {
        select: { identifier: true, account: { select: { email: true } } },
      },
    },
  });
  if (!config || config.provider !== "gmail") return null;
  const connectionData =
    config.connectionData && typeof config.connectionData === "object"
      ? (config.connectionData as Record<string, unknown>)
      : {};
  return {
    accountId: config.accountId,
    channelId: config.channelId,
    externalAccountId,
    status: config.status,
    nosAdresses: [config.channel.identifier, config.channel.account?.email],
    donnees: connectionData as Partial<DonneesGmail>,
    connectionData,
  };
}

/** Pose ou remplace quelques clés des données de connexion, le reste intact. */
export async function ecrireDonnees(
  channelId: string,
  patch: Partial<DonneesGmail>,
): Promise<void> {
  const actuel = await prisma.channelConfig.findUnique({
    where: { channelId },
    select: { connectionData: true },
  });
  const base =
    actuel?.connectionData && typeof actuel.connectionData === "object"
      ? (actuel.connectionData as Record<string, unknown>)
      : {};
  await prisma.channelConfig.updateMany({
    where: { channelId },
    data: { connectionData: { ...base, ...patch } as Prisma.InputJsonValue },
  });
}
