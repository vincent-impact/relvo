// Les HÔTES de Relvo (M24.10) — un seul déployable, trois noms :
//
//   • le SITE, `relvo.net` : la page de présentation et les pages légales, lues
//     hors de l'application et sans session. C'est l'adresse que Google lit
//     pour la vérification de l'application (page d'accueil, confidentialité,
//     conditions) ;
//   • l'APPLICATION, `app.relvo.net` : tout le reste, dont les webhooks ;
//   • l'ANCIENNE adresse, `relvo-app.vercel.app` : redirigée vers l'application,
//     sauf ses routes d'API, pour que rien ne se perde pendant la bascule.
//
// Le routage par hôte vit dans `next.config.ts` (redirections, réécriture de
// la racine du site) ; l'autorisation dans `auth.config.ts` (la racine du site
// est publique, celle de l'application ne l'est pas). Les deux lisent les mêmes
// valeurs, surchargeables par l'environnement pour un poste local.
//
// ⚠️ Edge-safe : aucune dépendance, le proxy l'importe.

export const SITE_HOST = process.env.RELVO_SITE_HOST ?? "relvo.net";
export const APP_HOST = process.env.RELVO_APP_HOST ?? "app.relvo.net";
export const ANCIEN_HOST = "relvo-app.vercel.app";

export const SITE_URL = `https://${SITE_HOST}`;
export const APP_URL = `https://${APP_HOST}`;

/** Le chemin interne de la page d'accueil du site : `/` sur `relvo.net` y est réécrit. */
export const SITE_ACCUEIL = "/site";

/** Les pages du site, par leur chemin PUBLIC (sur `relvo.net`). */
export const SITE_PAGES = ["/", "/confidentialite", "/conditions"] as const;

type RequeteAvecHote = {
  headers?: { get(name: string): string | null };
  nextUrl?: { hostname?: string };
};

/**
 * L'hôte d'une requête, sans port, en minuscules — `null` s'il manque. L'en-tête
 * `Host` d'abord : c'est lui que portent les règles `has: host` de
 * `next.config.ts`, et en développement `nextUrl` dit `localhost` quel que
 * soit l'hôte demandé — un test au `curl -H Host:` ne verrait rien sans ça.
 */
export function hoteDe(req: RequeteAvecHote): string | null {
  const h =
    req.headers?.get("host")?.replace(/:\d+$/, "") ?? req.nextUrl?.hostname;
  return h ? h.trim().toLowerCase() : null;
}

export function estLeSite(req: RequeteAvecHote): boolean {
  return hoteDe(req) === SITE_HOST;
}
