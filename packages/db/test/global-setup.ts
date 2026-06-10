import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

// Setup global des tests : crée la base `relvo_test` si besoin puis y applique
// les migrations. Exécuté une fois avant la suite (process principal vitest).

function withDatabase(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export default async function setup() {
  loadEnv({ path: resolve(import.meta.dirname, "../.env") });
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL absente : impossible de préparer les tests.");
  }
  const testUrl =
    process.env.TEST_DATABASE_URL ?? withDatabase(base, "relvo_test");
  const dbName = new URL(testUrl).pathname.replace(/^\//, "").split("?")[0]!;

  // 1. Crée la base de test si elle n'existe pas (connexion à la base admin).
  const admin = new Client({
    connectionString: withDatabase(base, "postgres"),
  });
  await admin.connect();
  const { rowCount } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  // 2. Applique les migrations sur la base de test (dotenv ne surcharge pas une
  //    var déjà posée → DATABASE_URL=testUrl est bien pris en compte).
  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      DATABASE_URL_UNPOOLED: testUrl,
    },
    stdio: "inherit",
  });
}
