import { Actor, type Sector } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { avecOrigine, EVENT_TYPES, logEvent, type Origine } from "./events";

// Domaine Account — le peu qui se règle sur le compte lui-même. `Account` n'est
// pas scopé par le client tenant (c'est la racine), d'où l'identifiant explicite
// sur chaque fonction : l'appelant le tient de la session, jamais d'un
// paramètre client.

/**
 * L'assistant est-il actif sur ce compte ? Gouverne TOUT ce que Relvo fait de
 * lui-même — le tri à l'arrivée aujourd'hui, la structuration, la relecture et
 * l'échange demain. Faux par défaut : un compte nouveau ne sollicite rien.
 */
export async function isAssistantEnabled(
  db: TenantDb,
  accountId: string,
): Promise<boolean> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { assistantEnabled: true },
  });
  return account?.assistantEnabled ?? false;
}

/**
 * Active ou coupe l'assistant sur le compte. C'est LA méthode par laquelle
 * l'état change — le réglage de l'utilisateur (Réglages › Préférences)
 * aujourd'hui, le backoffice d'administration demain : couper l'usage d'un
 * compte à tout moment passe par ici, jamais par la base. Journalisé, avec
 * l'acteur, pour qu'on sache qui a coupé quoi.
 */
export async function setAssistantEnabled(
  db: TenantDb,
  accountId: string,
  enabled: boolean,
  actor: Actor = Actor.user,
): Promise<{ assistantEnabled: boolean; changed: boolean }> {
  const current = await isAssistantEnabled(db, accountId);
  if (current === enabled) return { assistantEnabled: enabled, changed: false };
  await db.account.update({
    where: { id: accountId },
    data: { assistantEnabled: enabled },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: enabled
      ? EVENT_TYPES.assistantEnabled
      : EVENT_TYPES.assistantDisabled,
    title: enabled ? "Assistant Relvo activé" : "Assistant Relvo coupé",
    actor,
  });
  return { assistantEnabled: enabled, changed: true };
}

/**
 * Les diapositives de première connexion ont été vues — terminées ou passées
 * (01 §11, M19.9). Elles ne se montrent qu'une fois, et la trace vit sur le
 * compte, jamais dans le navigateur. Une vue n'est pas une décision : rien
 * n'est journalisé. Idempotent : une seconde pose ne recule pas la date.
 */
export async function markWelcomeSeen(
  db: TenantDb,
  accountId: string,
  at: Date = new Date(),
): Promise<void> {
  await db.account.updateMany({
    where: { id: accountId, welcomeSeenAt: null },
    data: { welcomeSeenAt: at },
  });
}

/**
 * Les SECTEURS du compte — ce qui choisit les socles métier de la couche
 * Produit (05 §10.1). Posés par la prise en main (une réponse de Relvo,
 * 05 §11.11) ou par le profil. Journalisé : c'est une décision du dirigeant.
 */
export async function setSectors(
  db: TenantDb,
  accountId: string,
  sectors: readonly Sector[],
  origine?: Origine,
): Promise<{ sectors: Sector[] }> {
  const uniques = [...new Set(sectors)];
  await db.account.update({
    where: { id: accountId },
    data: { sectors: uniques },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.sectorsUpdated,
    title: `Secteurs : ${uniques.length ? uniques.join(", ") : "aucun"}`,
    actor: Actor.user,
    metadata: avecOrigine({ sectors: uniques }, origine),
  });
  return { sectors: uniques };
}
