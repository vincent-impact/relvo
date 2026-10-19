import webpush, { WebPushError } from "web-push";
import {
  listPushSubscriptions,
  recordPushSent,
  removePushSubscription,
  tenantDb,
} from "@relvo/db";
import {
  abonnementMort,
  chargeUtile,
  TTL_SECONDES,
  type NotificationRelvo,
} from "./regles";

// L'ENVOI d'une notification (M12.7, M12.9) — le seul endroit qui parle aux
// services de push des navigateurs, avec les clés VAPID du déploiement. Le
// domaine tient la liste des appareils et le journal ; ici on signe, on envoie,
// on retire les appareils morts, on consigne.
//
// Pas de `server-only` ici, volontairement : le script `push:essai` tourne hors
// Next et l'importe. La garde est tenue par `web-push` lui-même, Node pur, qu'un
// bundle client refuserait à la construction.

export function pushDisponible(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

/** La clé publique que l'écran donne à `PushManager.subscribe()`. */
export function clePubliquePush(): string | null {
  return pushDisponible() ? process.env.VAPID_PUBLIC_KEY! : null;
}

let configure = false;
function configurer(): void {
  if (configure) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configure = true;
}

export type BilanEnvoi = { envoyes: number; retires: number; echecs: number };

/**
 * Envoie une notification à tous les appareils abonnés d'un compte. Sans
 * appareil, rien ne part et rien n'est journalisé. Un appareil disparu (404,
 * 410) est retiré ; un échec passager laisse la ligne en place.
 */
export async function envoyerNotification(
  accountId: string,
  notification: NotificationRelvo,
): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { envoyes: 0, retires: 0, echecs: 0 };
  if (!pushDisponible()) return bilan;
  const db = tenantDb(accountId);
  const cibles = await listPushSubscriptions(db);
  if (cibles.length === 0) return bilan;
  try {
    configurer();
  } catch (err) {
    // Des clés mal formées (un sujet qui n'est ni https: ni mailto:) : un
    // défaut de configuration, jamais une erreur remontée à l'écran.
    console.error("[push] configuration VAPID refusée", err);
    bilan.echecs = cibles.length;
    return bilan;
  }

  const charge = chargeUtile(notification);
  const servis: string[] = [];
  await Promise.all(
    cibles.map(async (cible) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: cible.endpoint,
            keys: { p256dh: cible.p256dh, auth: cible.auth },
          },
          charge,
          { TTL: TTL_SECONDES[notification.kind], urgency: "normal" },
        );
        servis.push(cible.id);
        bilan.envoyes += 1;
      } catch (err) {
        const status = err instanceof WebPushError ? err.statusCode : undefined;
        if (abonnementMort(status)) {
          await removePushSubscription(
            db,
            accountId,
            cible.endpoint,
            "service",
          );
          bilan.retires += 1;
        } else {
          bilan.echecs += 1;
          console.warn("[push] envoi en échec", {
            accountId,
            kind: notification.kind,
            status,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }),
  );

  if (servis.length > 0) {
    await recordPushSent(db, accountId, {
      kind: notification.kind,
      subscriptionIds: servis,
      title:
        notification.titre === "Relvo"
          ? notification.corps
          : notification.titre,
    });
  }
  console.info("[push]", { accountId, kind: notification.kind, ...bilan });
  return bilan;
}
