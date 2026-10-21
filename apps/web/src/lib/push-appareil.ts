import {
  cleEnOctets,
  disponibilitePush,
  type DisponibilitePush,
} from "@/lib/push-client";
import { abonnerPushAction, desabonnerPushAction } from "@/server/actions/push";

// L'ABONNEMENT DE CET APPAREIL (M12.7, M12.9) — côté navigateur, partagé par
// la ligne des Préférences et par l'invitation de la prise en main : où en est
// l'appareil, s'abonner sur un geste (jamais au chargement), se désabonner. La
// règle « quand reproposer » est pure et vit dans `push-client.ts`.

export type EtatPush =
  | {
      kind: "impossible";
      raison: Exclude<DisponibilitePush, "disponible"> | "sans-cle";
    }
  | { kind: "refuse" }
  | { kind: "pret"; actif: boolean };

const SW_URL = "/sw.js";

async function abonnementCourant(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

function enEntree(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

/** Où en est cet appareil. Un appareil déjà abonné se redit au serveur, sans bruit. */
export async function etatPushAppareil(
  clePublique: string | null,
): Promise<EtatPush> {
  if (!clePublique) return { kind: "impossible", raison: "sans-cle" };
  const dispo = disponibilitePush({
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    notification: "Notification" in window,
    userAgent: navigator.userAgent,
  });
  if (dispo !== "disponible") return { kind: "impossible", raison: dispo };
  if (Notification.permission === "denied") return { kind: "refuse" };
  try {
    const sub = await abonnementCourant();
    if (sub) void abonnerPushAction(enEntree(sub));
    return { kind: "pret", actif: Boolean(sub) };
  } catch {
    return { kind: "pret", actif: false };
  }
}

/** S'abonner sur un geste de l'utilisateur : la permission, le worker, l'abonnement, le serveur. */
export async function activerPushAppareil(
  clePublique: string,
): Promise<
  { ok: true } | { ok: false; raison: "refuse" | "annule" | "erreur" }
> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, raison: permission === "denied" ? "refuse" : "annule" };
  }
  try {
    const registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;
    const sub =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleEnOctets(clePublique) as BufferSource,
      }));
    const result = await abonnerPushAction(enEntree(sub));
    if (!result.ok) throw new Error(result.message);
    return { ok: true };
  } catch (err) {
    console.warn("[push] abonnement", err);
    return { ok: false, raison: "erreur" };
  }
}

/** Désabonner cet appareil : chez le navigateur, puis chez le serveur. */
export async function couperPushAppareil(): Promise<void> {
  const sub = await abonnementCourant();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const result = await desabonnerPushAction(endpoint);
  if (!result.ok) throw new Error(result.message);
}

export const PLUS_TARD_CLE = "relvo.notifications.plus-tard";

/** « Plus tard » se retient sur l'appareil ; lit/écrit en tolérant un stockage absent. */
export function lirePlusTard(): string | null {
  try {
    return window.localStorage.getItem(PLUS_TARD_CLE);
  } catch {
    return null;
  }
}
export function poserPlusTard(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(PLUS_TARD_CLE, now.toISOString());
  } catch {
    // Sans stockage, l'invitation reviendra : mieux que jamais.
  }
}
