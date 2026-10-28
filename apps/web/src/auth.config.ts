import type { NextAuthConfig } from "next-auth";
import { estLeSite } from "@/lib/hotes";

// Routes publiques (accessibles sans session). Tout le reste est protégé par
// défaut — invariant produit : l'app n'est jamais accessible anonymement,
// hormis le tunnel d'authentification.
const PUBLIC_ROUTES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/verifier-email",
  // Page de suivi client (M15) — hors application, sans session. Elle n'existe
  // qu'au chemin du jeton : tout le reste de `/suivi/*` tombe en 404 côté route
  // (`dynamicParams = false`), pas ici. ⚠️ Ouvrir une entrée de cette liste est
  // le geste que surveille `test/auth-deny-by-default.test.ts` — l'y ajouter
  // sans mettre le test à jour le fait échouer, dans les deux sens.
  "/suivi",
  // Le SITE (M24.10) : la page de présentation et les pages légales, lues par
  // n'importe qui — et par Google pour la vérification de l'application. La
  // racine du site (`/` sur `relvo.net`) est ouverte par l'hôte, plus bas :
  // `/` sur l'application reste fermée. ⚠️ Surveillé par le même test.
  "/site",
  "/confidentialite",
  "/conditions",
];

// La zone d'administration (M21.1) : réservée au rôle `admin`, lu dans le jeton
// de session. Un compte connecté sans ce rôle est renvoyé à l'accueil, pas à la
// connexion — il EST connecté, il n'a juste rien à faire là. Le layout de la
// zone relit le rôle en base à chaque rendu : ce garde-ci est le premier
// rideau, pas le seul. ⚠️ Surveillé par `test/auth-deny-by-default.test.ts`.
const ADMIN_ROUTES = ["/admin"];

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
    authorized({ auth, request }) {
      const { nextUrl } = request;
      // Routes publiques toujours autorisées ; tout le reste exige une session
      // (sinon redirection vers /connexion via pages.signIn). La redirection
      // d'un utilisateur déjà connecté hors des pages d'entrée est gérée côté
      // page (redirect serveur), plus fiable que depuis ce callback.
      if (matches(PUBLIC_ROUTES, nextUrl.pathname)) return true;
      // La racine du SITE est sa page d'accueil (réécrite vers `/site` après
      // ce proxy) : publique sur cet hôte seulement.
      if (nextUrl.pathname === "/" && estLeSite(request)) return true;
      if (!auth?.user) return false;
      if (
        matches(ADMIN_ROUTES, nextUrl.pathname) &&
        auth.user.role !== "admin"
      ) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    // La session lue depuis le jeton — ICI, et pas seulement dans `auth.ts` :
    // le proxy construit `auth` avec les callbacks de CETTE config. Sans ce
    // callback, `auth.user.role` n'existe pas dans le proxy et la zone
    // d'administration renverrait tout le monde à l'accueil, administrateur
    // compris. Pure (aucune base) : edge-safe. `auth.ts` la reprend par
    // `...authConfig.callbacks`. Le type JWT d'@auth/core n'étant pas
    // augmentable proprement avec pnpm, on caste ; la session, elle, est typée
    // (cf. types/next-auth.d.ts).
    session({ session, token }) {
      if (token.accountId) session.user.id = token.accountId as string;
      if (token.role)
        session.user.role = token.role as typeof session.user.role;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
