/**
 * Provisioning du compte démo au déploiement (`vercel-build`). Non destructif :
 * crée le compte démo seulement s'il est absent, sinon ne fait rien. Volontaire-
 * ment NON bloquant — une erreur de seed (ex. base injoignable) loggue un
 * avertissement mais ne fait pas échouer le build (exit 0).
 */
import "dotenv/config";
import { prisma, seedDemoIfMissing } from "../src/index";

seedDemoIfMissing()
  .then(({ created }) =>
    console.info(
      created
        ? "[seed:ensure] Compte démo créé."
        : "[seed:ensure] Compte démo déjà présent — aucune action.",
    ),
  )
  .catch((error) =>
    console.warn(
      "[seed:ensure] Seed du compte démo ignoré (non bloquant) :",
      error instanceof Error ? error.message : error,
    ),
  )
  .finally(() => prisma.$disconnect());
