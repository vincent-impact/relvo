/**
 * Script CLI de seed (`pnpm db:seed`). La logique vit dans
 * `src/seed-demo.ts` (source unique, réutilisée par la Server Action de reset).
 */
import "dotenv/config";
import { prisma, seedDemoAccount } from "../src/index";

seedDemoAccount()
  .then((counts) => console.info("[seed] Tasty Crousty créé :", counts))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
