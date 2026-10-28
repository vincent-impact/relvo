import path from "node:path";
import type { NextConfig } from "next";
import {
  ANCIEN_HOST,
  APP_HOST,
  APP_URL,
  SITE_ACCUEIL,
  SITE_HOST,
  SITE_URL,
} from "./src/lib/hotes";

const nextConfig: NextConfig = {
  // Le traçage part du dossier du projet Next (`apps/web`) : « any files outside
  // of that folder will not be included » (doc Next). Or nos fixtures de démo
  // vivent dans `packages/db/prisma/fixtures/`. On remonte donc à la racine du
  // monorepo, sinon l'include ci-dessous ne peut pas les atteindre.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),

  // `seedDemoFiles` lit les PDF de démo avec `readFile()` et un chemin construit
  // à l'exécution depuis `import.meta.url`. Le traceur (@vercel/nft) analyse les
  // `import`/`require`/`fs` STATIQUEMENT : il ne peut pas voir ce chemin, donc il
  // n'embarque pas les fichiers. En local ça marche (le monorepo est sur le
  // disque) ; sur Vercel, `readFile` lève ENOENT et le reset démo renvoie 500.
  //
  // Le bouton « Réinitialiser » vit sur /profil → c'est cette route qui doit
  // porter les fixtures dans son bundle.
  outputFileTracingIncludes: {
    "/profil": ["../../packages/db/prisma/fixtures/**"],
  },
  // @relvo/db et @relvo/storage exposent du TypeScript brut : Next doit les
  // transpiler comme du code applicatif.
  transpilePackages: ["@relvo/db", "@relvo/storage"],

  images: {
    // Nos fichiers privés sont servis par /api/{documents,attachments}/[id]/
    // download, qui REDIRIGE (307) vers une URL R2 signée. L'optimiseur d'images
    // suit les redirections « without validating remotePatterns again on the
    // redirect location » (doc next/image) — autrement dit, une origine
    // autorisée qui redirige fait sauter la frontière de sécurité.
    //
    // 1 suffit à notre chaîne (route → R2). Le défaut est 3, ce qui laisserait
    // une marge inutile si une cible était un jour dérivée d'un input client.
    // Chez nous elle ne l'est jamais : la clé vient de la base scopée tenant.
    maximumRedirects: 1,

    // Pas de `remotePatterns` : aucune image distante n'est référencée
    // directement. ⚠️ Si on en ajoute un jour, ne JAMAIS omettre `search` — la
    // doc avertit que ça « could allow malicious actors to optimize URLs you did
    // not intend » (proxy d'optimisation ouvert). Et ne jamais y mettre une URL
    // pré-signée : la clé de cache Vercel inclut la query string, donc une
    // signature qui tourne = un MISS et une transformation FACTURÉE à chaque
    // rendu. C'est précisément pour ça qu'on passe par une URL stable.
  },

  // Routes mortes de la disposition M18 (M18.10) : un signet ou une relance
  // d'ancienne page atterrit sur la vue qui l'a remplacée.
  async redirects() {
    return [
      // ── Les hôtes (M24.10, `lib/hotes.ts`) ───────────────────────────────
      // L'ANCIENNE adresse renvoie vers l'application, chemin et requête
      // conservés — sauf les routes d'API : un webhook ou un cron qui arrive
      // encore là doit être SERVI, pas promené par une redirection qu'un
      // POST ne suit pas forcément. Les webhooks de l'agrégateur sont
      // réenregistrés sur la nouvelle adresse ; cette exception est le filet.
      {
        source: "/",
        has: [{ type: "host", value: ANCIEN_HOST }],
        destination: `${APP_URL}/`,
        permanent: true,
      },
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: ANCIEN_HOST }],
        destination: `${APP_URL}/:path`,
        permanent: true,
      },
      // Sur le SITE, tout ce qui n'est pas une page du site est l'application
      // (quelqu'un tape `relvo.net/connexion`) : on l'y envoie. La racine, elle,
      // est réécrite vers la page d'accueil du site (cf. `rewrites`).
      {
        source: "/:path((?!confidentialite$|conditions$|api/).+)",
        has: [{ type: "host", value: SITE_HOST }],
        destination: `${APP_URL}/:path`,
        permanent: true,
      },
      // Les pages du site demandées sur l'APPLICATION renvoient au site : une
      // seule adresse pour chacune, celle que Google a lue.
      {
        source: SITE_ACCUEIL,
        has: [{ type: "host", value: APP_HOST }],
        destination: `${SITE_URL}/`,
        permanent: true,
      },
      {
        source: "/:page(confidentialite|conditions)",
        has: [{ type: "host", value: APP_HOST }],
        destination: `${SITE_URL}/:page`,
        permanent: true,
      },
      { source: "/planning", destination: "/calendrier", permanent: true },
      { source: "/messages", destination: "/conversations", permanent: true },
      {
        source: "/messages/:id",
        destination: "/conversations",
        permanent: true,
      },
      { source: "/dossiers", destination: "/memoire", permanent: true },
      { source: "/dossiers/:id", destination: "/memoire/:id", permanent: true },
      // Les Réglages à onglets ont éclaté en quatre pages du menu (M18) ; les
      // liens profonds `?tab=` retombent sur la bonne page, le reste sur Profil.
      ...(["canaux", "preferences", "usage"] as const).map((tab) => ({
        source: "/parametres",
        has: [{ type: "query" as const, key: "tab", value: tab }],
        destination: `/${tab}`,
        permanent: true,
      })),
      { source: "/parametres", destination: "/profil", permanent: true },
    ];
  },

  // La racine du SITE est sa page d'accueil (`(public)/site`), sans que le
  // chemin change dans la barre d'adresse ; sur tout autre hôte, `/` reste
  // l'accueil de l'application. `beforeFiles` : avant le système de fichiers,
  // après le proxy — qui voit donc `/` sur l'hôte du site et le laisse passer
  // (`auth.config.ts`).
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: SITE_HOST }],
          destination: SITE_ACCUEIL,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  experimental: {
    // Cache client (Router Cache) : durée pendant laquelle un payload de route
    // déjà visité est réutilisé SANS aller-retour serveur (navigation/retour
    // instantanés). Le défaut Next pour les routes dynamiques est 0 — or toutes
    // nos pages sont dynamiques (cookie de session) → aucun cache, d'où le
    // « ça recharge alors que j'y étais ». On rouvre une fenêtre courte.
    //
    // Sûreté : nos mutations passent par des Server Actions qui appellent
    // revalidatePath → le cache est purgé après chaque écriture, donc l'UI reste
    // toujours juste après une action. Le seul décalage possible (≤ dynamic s)
    // concerne un changement EXTERNE (nouveau message écrit par le worker), qui
    // sera couvert par le polling 30 s (M12.3). Aligné sur ce cycle.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
