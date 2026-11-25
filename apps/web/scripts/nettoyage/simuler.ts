// CE QUE LE NETTOYAGE RETIRERAIT — une SIMULATION, toujours : rien n'est
// écrit. Compte par compte, les sujets fermés depuis plus de trente jours, les
// messages qu'aucun sujet ne porte depuis plus de trente jours, leurs pièces,
// et les conversations e-mail qui ne garderaient plus rien. Les mêmes filtres
// que le passage réel du cron du matin (`@relvo/db`, `domain/nettoyage.ts`).
//
// Usage : pnpm --filter web nettoyage:simuler [<e-mail>]
//
// Tourne sur la base que `DATABASE_URL` désigne ; un accès en lecture suffit.
// Le passage réel ne se lance pas d'ici : c'est le cron du matin, quand
// `NETTOYAGE_ACTIF` (`src/server/nettoyage.ts`) est vrai.
import {
  RETENTION_SANS_SUJET_JOURS,
  additionnerBilans,
  bilanEstVide,
  bilanVide,
  prisma,
  simulerLeNettoyage,
  tenantDb,
  type BilanNettoyage,
} from "@relvo/db";
import { octets } from "../../src/lib/stockage";

const ligne = (b: BilanNettoyage) =>
  `${b.messages} message(s), ${b.pieces} pièce(s) (${octets(b.octets)}), ${b.conversationsEmail} conversation(s) e-mail, ${b.sujetsFermes} sujet(s) fermé(s)`;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const comptes = await prisma.account.findMany({
    where: email ? { email } : {},
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (email && comptes.length === 0)
    throw new Error(`compte inconnu : ${email}`);

  console.log(
    `SIMULATION — ce que le nettoyage retirerait aujourd'hui (au-delà de ${RETENTION_SANS_SUJET_JOURS} jours). Rien n'est écrit.`,
  );
  let total = bilanVide();
  let touches = 0;
  for (const compte of comptes) {
    const bilan = await simulerLeNettoyage(tenantDb(compte.id));
    if (bilanEstVide(bilan)) continue;
    touches += 1;
    total = additionnerBilans(total, bilan);
    console.log(`  ${compte.email} — ${ligne(bilan)}`);
  }
  console.log(`\nTOTAL sur ${touches} compte(s) touché(s) : ${ligne(total)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
