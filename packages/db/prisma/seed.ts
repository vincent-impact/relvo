/**
 * Script CLI de seed (`pnpm db:seed`). La logique vit dans
 * `src/seed-demo.ts` (source unique, réutilisée par la Server Action de reset).
 */
import "dotenv/config";
import { createR2Storage } from "@relvo/storage";
import { prisma, seedDemoAccount } from "../src/index";

// Le stockage est injecté ici (le domaine ne dépend pas de `@relvo/storage`).
// Sans variables R2_*, on seed quand même : les documents existeront en base
// mais leurs fichiers non — le seed le signale.
function storageOrNull() {
  try {
    return createR2Storage();
  } catch {
    return undefined;
  }
}

seedDemoAccount(storageOrNull())
  .then((counts) => console.info("[seed] Tasty Crousty créé :", counts))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
