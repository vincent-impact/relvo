import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @relvo/db expose du TypeScript brut (src/index.ts + client Prisma généré) :
  // Next doit le transpiler comme du code applicatif.
  transpilePackages: ["@relvo/db"],

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
