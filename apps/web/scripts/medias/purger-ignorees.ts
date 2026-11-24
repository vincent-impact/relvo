// LE STOCK DÉJÀ IGNORÉ (M25.12) — retire les pièces et la mise en forme (HTML)
// des conversations IGNORÉES, par le domaine : une transaction et une entrée de
// journal par conversation. Le texte des messages reste ; ce qu'un sujet porte
// reste ; les fichiers partent par la file de suppression, que le drainage vide.
//
// Usage : pnpm --filter web medias:purger [<e-mail>] [--executer]
//
// SANS `--executer`, c'est une SIMULATION : rien n'est écrit, le script dit ce
// qu'il retirerait, compte par compte. Sans e-mail, tous les comptes.
//
// Tourne sur la base que `DATABASE_URL` désigne : la base locale par défaut, la
// production en pointant la variable sur elle, le temps du geste.
// ⚠️ IRRÉVERSIBLE dans Relvo : les originaux restent dans la boîte e-mail ou
// sur le téléphone, mais réactiver une conversation ne les ramène pas.
import {
  countPendingFileDeletions,
  prisma,
  purgerConversationIgnoree,
  stockIgnoreDuCompte,
  tenantDb,
  totalDuStock,
  type StockIgnore,
} from "@relvo/db";

const poids = (octets: number) =>
  octets >= 1e9
    ? `${(octets / 1e9).toFixed(2)} Go`
    : `${(octets / 1e6).toFixed(1)} Mo`;

const ligne = (t: StockIgnore) =>
  `${t.conversations} conversation(s) · ${t.pieces} pièce(s), ${poids(t.octets)} · HTML de ${t.messagesHtml} message(s), ${poids(t.octetsHtml)}`;

async function main() {
  const args = process.argv.slice(2);
  const executer = args.includes("--executer");
  const email = args
    .find((a) => !a.startsWith("--"))
    ?.trim()
    .toLowerCase();

  const comptes = await prisma.account.findMany({
    where: email ? { email } : {},
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (email && comptes.length === 0)
    throw new Error(`compte inconnu : ${email}`);

  console.log(
    executer
      ? "PURGE — les pièces et le HTML des conversations ignorées sont retirés."
      : "SIMULATION — rien n'est écrit. Ajoutez --executer pour purger.",
  );

  const annonce: StockIgnore = {
    conversations: 0,
    pieces: 0,
    octets: 0,
    messagesHtml: 0,
    octetsHtml: 0,
  };
  const retire = { conversations: 0, pieces: 0, octets: 0, messagesHtml: 0 };

  for (const compte of comptes) {
    const stock = await stockIgnoreDuCompte(compte.id);
    if (stock.length === 0) continue;
    const total = totalDuStock(stock);
    for (const k of Object.keys(annonce) as (keyof StockIgnore)[])
      annonce[k] += total[k];
    console.log(`  ${compte.email} — ${ligne(total)}`);
    if (!executer) continue;

    const db = tenantDb(compte.id);
    for (const [i, c] of stock.entries()) {
      const bilan = await purgerConversationIgnoree(db, c.conversationId);
      if (bilan) {
        retire.conversations += 1;
        retire.pieces += bilan.pieces;
        retire.octets += bilan.octets;
        retire.messagesHtml += bilan.messagesHtml;
      }
      if ((i + 1) % 100 === 0) console.log(`    … ${i + 1} / ${stock.length}`);
    }
  }

  console.log(`\nTOTAL annoncé — ${ligne(annonce)}`);
  if (!executer) return;
  console.log(
    `TOTAL retiré  — ${retire.conversations} conversation(s) · ${retire.pieces} pièce(s), ${poids(retire.octets)} · HTML de ${retire.messagesHtml} message(s)`,
  );
  console.log(
    `File de suppression : ${await countPendingFileDeletions()} fichier(s) en attente. Le cron du matin la draine ; pour la vider tout de suite :\n  curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/drain-file-deletions`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
