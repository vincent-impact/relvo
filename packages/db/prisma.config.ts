import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 : la config CLI (schéma, migrations, URL de connexion) vit ici,
// plus dans le bloc datasource du schéma. Cf. https://pris.ly/prisma-config
//
// L'URL de connexion vient de l'environnement (DATABASE_URL) :
//  - en local : chargée depuis packages/db/.env par `dotenv/config` ;
//  - sur Vercel / CI : injectée par le dashboard.
//
// Les commandes CLI (migrate, studio) utilisent une connexion **directe**
// (non poolée) : le pooler PgBouncer de Neon casse les migrations Prisma
// (verrous de session). On privilégie donc l'URL non-poolée si elle existe,
// avec fallback sur DATABASE_URL (cas local = Docker, connexion directe).
// NB : le runtime de l'app, lui, utilise DATABASE_URL (poolée) — cf. src/index.ts.
//
// On ne déclare le `datasource` QUE si une URL est présente. Conséquence :
// `prisma generate` (qui ne se connecte pas) réussit même sans base configurée
// — indispensable pour le build Vercel d'un socle sans DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
