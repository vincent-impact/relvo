import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests d'intégration (M3.14) sur une base dédiée `relvo_test`, isolée de la
// base de dev. On dérive l'URL de test depuis DATABASE_URL (.env) en changeant
// le nom de base, sauf si TEST_DATABASE_URL est fourni explicitement.

loadEnv({ path: resolve(import.meta.dirname, ".env") });

function withDatabase(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

const base = process.env.DATABASE_URL;
const testUrl =
  process.env.TEST_DATABASE_URL ??
  (base ? withDatabase(base, "relvo_test") : "");

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Le singleton Prisma lit DATABASE_URL à l'import : on le pointe sur la base
    // de test avant le chargement des modules de test.
    env: { DATABASE_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl },
    // Une seule base partagée → pas de parallélisme inter-fichiers.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
