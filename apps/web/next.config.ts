import path from "node:path";
import type { NextConfig } from "next";

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
  // Le bouton « Réinitialiser » vit sur /parametres → c'est cette route qui doit
  // porter les fixtures dans son bundle.
  outputFileTracingIncludes: {
    "/parametres": ["../../packages/db/prisma/fixtures/**"],
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
