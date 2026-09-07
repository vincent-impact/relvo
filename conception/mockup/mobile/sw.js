// Service worker minimal — requis pour rendre la PWA installable (Android).
// Pas de cache offline en V0 de maquette : on laisse passer le réseau.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());
self.addEventListener('fetch', (e) => { /* passthrough réseau */ });
