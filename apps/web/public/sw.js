// Le service worker de Relvo — il ne fait QUE le push (M12.7, M12.9).
//
// Pas de cache, pas de hors-ligne : un worker qui intercepte les requêtes est un
// autre chantier. Ici, deux événements : une notification arrive, on l'affiche ;
// on la touche, on ouvre l'application sur la page qu'elle désigne. La charge
// utile est le JSON posé par `server/push/envoyer.ts` : { titre, corps, url, tag }.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let charge = {};
  try {
    charge = event.data ? event.data.json() : {};
  } catch {
    charge = { corps: event.data ? event.data.text() : "" };
  }
  const titre = charge.titre || "Relvo";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: charge.corps || "",
      // Un même `tag` remplace la notification précédente : une question
      // visible à la fois, un brief à la fois.
      tag: charge.tag || undefined,
      renotify: Boolean(charge.tag),
      icon: "/relvo-icon-192.png",
      badge: "/relvo-icon-96.png",
      data: { url: charge.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((fenetres) => {
        for (const fenetre of fenetres) {
          if ("focus" in fenetre) {
            if ("navigate" in fenetre) {
              return fenetre.navigate(cible).then((f) => (f || fenetre).focus());
            }
            return fenetre.focus();
          }
        }
        return self.clients.openWindow(cible);
      }),
  );
});
