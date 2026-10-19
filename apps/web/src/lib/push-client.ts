// Côté navigateur (M12.7, M12.9) : ce qu'il faut pour s'abonner au push. Module
// PUR, tenu par `test/push.test.ts`.

/** La clé publique VAPID (base64 URL) dans la forme que `PushManager.subscribe()` attend. */
export function cleEnOctets(base64url: string): Uint8Array {
  const complement = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + complement).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

export type DisponibilitePush =
  /** Tout est là : service worker, PushManager, Notification. */
  | "disponible"
  /** iPhone ou iPad hors application installée : Safari n'offre le push qu'à l'écran d'accueil. */
  | "ios-non-installe"
  /** Le navigateur n'a pas de push du tout. */
  | "indisponible";

/**
 * Le push est-il possible ici ? Sur iOS, `PushManager` n'existe que dans
 * l'application installée depuis Safari (iOS 16.4+) : son absence sur un
 * iPhone veut dire « installez-la », pas « impossible ».
 */
export function disponibilitePush(env: {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  userAgent: string;
}): DisponibilitePush {
  if (env.serviceWorker && env.pushManager && env.notification)
    return "disponible";
  if (/iPhone|iPad|iPod/i.test(env.userAgent)) return "ios-non-installe";
  return "indisponible";
}
