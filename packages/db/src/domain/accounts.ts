import {
  type AccountRole,
  Actor,
  type Sector,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
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
  opts: {
    /** Pourquoi l'administrateur coupe ou rétablit (M21.4) — en métadonnée, jamais obligatoire. */
    motif?: string | null;
  } = {},
): Promise<{ assistantEnabled: boolean; changed: boolean }> {
  const current = await isAssistantEnabled(db, accountId);
  if (current === enabled) return { assistantEnabled: enabled, changed: false };
  await db.account.update({
    where: { id: accountId },
    data: { assistantEnabled: enabled },
  });
  const motif = opts.motif?.trim() || null;
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: enabled
      ? EVENT_TYPES.assistantEnabled
      : EVENT_TYPES.assistantDisabled,
    title: enabled ? "Assistant Relvo activé" : "Assistant Relvo coupé",
    actor,
    metadata: motif ? { motif } : null,
  });
  return { assistantEnabled: enabled, changed: true };
}

// ─────────────────────────────────────────────────────────────
// L'administration d'un compte (M21) — trois gestes, tous journalisés sur le
// compte visé, acteur `system` : ils viennent du backoffice ou d'un script,
// jamais de l'utilisateur lui-même. `Account` n'étant pas scopé, l'appelant
// tient `accountId` du backoffice (rôle vérifié) ou de la ligne de commande.
// ─────────────────────────────────────────────────────────────

/**
 * Change le rôle du compte — c'est ainsi, et seulement ainsi, qu'un compte
 * devient administrateur ou cesse de l'être (M21.1, script `admin:role`).
 * Idempotent : le même rôle reposé n'écrit rien. ⚠️ Le proxy lit le rôle dans
 * le jeton de session : le nouveau rôle n'y entre qu'à la prochaine connexion.
 */
export async function setAccountRole(
  db: TenantDb,
  accountId: string,
  role: AccountRole,
): Promise<{ role: AccountRole; changed: boolean }> {
  const account = assertFound(
    await db.account.findUnique({
      where: { id: accountId },
      select: { role: true },
    }),
    "Compte",
  );
  if (account.role === role) return { role, changed: false };
  await db.account.update({ where: { id: accountId }, data: { role } });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.roleChanged,
    title: `Rôle : ${account.role} → ${role}`,
    actor: Actor.system,
    metadata: { de: account.role, vers: role },
  });
  return { role, changed: true };
}

/**
 * Marque le compte « test », ou retire la marque (M21.4) : une étiquette pour
 * les listes et les coûts du backoffice, rien de plus — elle ne change aucun
 * comportement du produit. Idempotent.
 */
export async function setAccountTest(
  db: TenantDb,
  accountId: string,
  isTest: boolean,
): Promise<{ isTest: boolean; changed: boolean }> {
  const account = assertFound(
    await db.account.findUnique({
      where: { id: accountId },
      select: { isTest: true },
    }),
    "Compte",
  );
  if (account.isTest === isTest) return { isTest, changed: false };
  await db.account.update({ where: { id: accountId }, data: { isTest } });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: isTest
      ? EVENT_TYPES.accountTestMarked
      : EVENT_TYPES.accountTestUnmarked,
    title: isTest ? "Compte marqué « test »" : "Compte retiré des tests",
    actor: Actor.system,
  });
  return { isTest, changed: true };
}

/**
 * Ouvre l'accès d'un compte créé par l'inscription (M21.6) : tant que
 * `activatedAt` est nul, le compte ne se connecte pas et voit la page
 * d'attente. C'est la validation de la demande par un administrateur.
 * Idempotent : un compte déjà ouvert ne l'est pas une seconde fois.
 */
export async function activateAccount(
  db: TenantDb,
  accountId: string,
  at: Date = new Date(),
): Promise<{ activatedAt: Date; changed: boolean }> {
  const account = assertFound(
    await db.account.findUnique({
      where: { id: accountId },
      select: { activatedAt: true, email: true },
    }),
    "Compte",
  );
  if (account.activatedAt) {
    return { activatedAt: account.activatedAt, changed: false };
  }
  await db.account.update({
    where: { id: accountId },
    data: { activatedAt: at },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.accountActivated,
    title: "Accès ouvert",
    actor: Actor.system,
  });
  return { activatedAt: at, changed: true };
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
