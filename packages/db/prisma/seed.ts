/**
 * Seed de développement — STUB.
 *
 * Le jeu de données Tasty Crousty (cohérent avec les maquettes) sera implémenté
 * au module M3.2 du backlog. Pour l'instant, ce fichier ne fait qu'exister pour
 * que `prisma db seed` / `pnpm --filter @relvo/db seed` tournent sans erreur.
 */
import { prisma } from "../src/index.js";

async function main() {
  console.info("[seed] stub — aucun enregistrement créé (cf. backlog M3.2).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
