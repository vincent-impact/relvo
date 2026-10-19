import { z } from "zod";
import { prisma } from "../index";
import type { TenantDb, Tx } from "../tenant";
import { EVENT_TYPES, logEvent } from "./events";

// LES ABONNEMENTS PUSH (M12.7, M12.9) — un appareil qui a accepté de recevoir
// les notifications de Relvo. L'abonnement EST le réglage : l'enregistrer,
// c'est activer ; le retirer, c'est couper. L'`endpoint` est l'adresse donnée
// par le service de push du navigateur, unique par appareil : un appareil qui
// change de compte change de propriétaire, il n'est jamais abonné deux fois.
// L'ENVOI lui-même n'est pas ici — il vit dans l'application (`server/push`),
// seule à parler aux services de push ; le domaine tient la liste et le journal.

/** Ce que `PushManager.subscribe()` rend, tel que l'écran l'envoie. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(400).nullish(),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Ce qu'il faut pour envoyer : l'adresse et les deux clés. */
export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Les natures de notification que Relvo envoie — et rien d'autre. */
export const PUSH_KINDS = ["bienvenue", "brief", "question"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/**
 * Enregistre l'abonnement d'un appareil. Idempotent sur l'endpoint : le même
 * appareil renvoyé rafraîchit ses clés sans ligne de plus ni événement. Un
 * endpoint tenu par un AUTRE compte (l'appareil a changé d'utilisateur) change
 * de main : l'ancienne ligne tombe, la nouvelle naît.
 */
export async function savePushSubscription(
  db: TenantDb,
  accountId: string,
  input: PushSubscriptionInput,
): Promise<{ id: string; created: boolean }> {
  const data = pushSubscriptionSchema.parse(input);
  // Cross-tenant, volontairement : l'endpoint est unique en base, et il ne
  // désigne qu'un appareil — pas un compte.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: data.endpoint, NOT: { accountId } },
  });
  const existing = await db.pushSubscription.findFirst({
    where: { endpoint: data.endpoint },
    select: { id: true },
  });
  if (existing) {
    await db.pushSubscription.updateMany({
      where: { id: existing.id },
      data: {
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent ?? null,
      },
    });
    return { id: existing.id, created: false };
  }
  const created = await db.pushSubscription.create({
    data: {
      accountId,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent: data.userAgent ?? null,
    },
    select: { id: true },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.pushSubscribed,
    title: "Notifications activées sur un appareil",
    actor: "user",
    metadata: { userAgent: data.userAgent ?? null },
  });
  return { id: created.id, created: true };
}

/**
 * Retire l'abonnement d'un appareil — parce que l'utilisateur a coupé les
 * notifications (`motif: "utilisateur"`), ou parce que le service de push a
 * répondu que l'appareil n'existe plus (`motif: "service"`). Vrai si une ligne
 * est tombée.
 */
export async function removePushSubscription(
  db: TenantDb,
  accountId: string,
  endpoint: string,
  motif: "utilisateur" | "service" = "utilisateur",
): Promise<boolean> {
  const { count } = await db.pushSubscription.deleteMany({
    where: { endpoint },
  });
  if (count === 0) return false;
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.pushUnsubscribed,
    title:
      motif === "service"
        ? "Un appareil ne reçoit plus les notifications"
        : "Notifications coupées sur un appareil",
    actor: motif === "service" ? "system" : "user",
    metadata: { motif },
  });
  return true;
}

/** Les appareils abonnés du compte. */
export async function listPushSubscriptions(
  db: TenantDb,
): Promise<PushTarget[]> {
  return db.pushSubscription.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
}

/** Le compte a-t-il au moins un appareil abonné ? */
export async function hasPushSubscription(db: TenantDb): Promise<boolean> {
  return (await db.pushSubscription.count()) > 0;
}

/**
 * Les comptes qui ont au moins un appareil abonné — cross-tenant, pour le cron
 * du matin, comme `listDueCatchups` : le cron ouvre ensuite un client tenant par
 * compte.
 */
export async function listPushAccounts(): Promise<string[]> {
  const rows = await prisma.pushSubscription.findMany({
    distinct: ["accountId"],
    select: { accountId: true },
    orderBy: { accountId: "asc" },
  });
  return rows.map((r) => r.accountId);
}

/** Une notification est partie : la date sur les appareils servis, une ligne au journal. */
export async function recordPushSent(
  db: TenantDb,
  accountId: string,
  args: { kind: PushKind; subscriptionIds: string[]; title: string; at?: Date },
): Promise<void> {
  const at = args.at ?? new Date();
  if (args.subscriptionIds.length > 0) {
    await db.pushSubscription.updateMany({
      where: { id: { in: args.subscriptionIds } },
      data: { lastSentAt: at },
    });
  }
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: accountId,
    eventType: EVENT_TYPES.pushSent,
    title: args.title,
    actor: "system",
    metadata: { kind: args.kind, appareils: args.subscriptionIds.length },
  });
}

/**
 * Une notification de cette nature est-elle déjà partie depuis `since` ? Le
 * journal fait foi : c'est ce qui tient « un brief par jour » sans colonne.
 */
export async function wasPushSentSince(
  db: TenantDb,
  kind: PushKind,
  since: Date,
): Promise<boolean> {
  const n = await db.eventLog.count({
    where: {
      eventType: EVENT_TYPES.pushSent,
      createdAt: { gte: since },
      metadata: { path: ["kind"], equals: kind },
    },
  });
  return n > 0;
}
