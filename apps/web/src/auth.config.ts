import type { NextAuthConfig } from "next-auth";

// Routes publiques (accessibles sans session). Tout le reste est protégé par
// défaut — invariant produit : l'app n'est jamais accessible anonymement,
// hormis le tunnel d'authentification.
const PUBLIC_ROUTES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/verifier-email",
];

const matches = (routes: string[], pathname: string) =>
  routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));

/**
 * Configuration Auth.js **edge-safe** : aucune dépendance Node (ni Prisma, ni
 * bcrypt). C'est elle que consomme `proxy.ts` pour gater les routes. Les
 * providers réels et les callbacks qui touchent la base vivent dans `auth.ts`.
 */
export const authConfig = {
  // Fait confiance à l'hôte de la requête (auto sur Vercel ; explicite ici pour
  // couvrir dev local et déploiements derrière proxy).
  trustHost: true,
  pages: {
    signIn: "/connexion",
  },
  // Renseignés dans auth.ts (Node) — vides ici pour rester edge-safe.
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Routes publiques toujours autorisées ; tout le reste exige une session
      // (sinon redirection vers /connexion via pages.signIn). La redirection
      // d'un utilisateur déjà connecté hors des pages d'entrée est gérée côté
      // page (redirect serveur), plus fiable que depuis ce callback.
      if (matches(PUBLIC_ROUTES, nextUrl.pathname)) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
