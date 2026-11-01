// Répare les CONVERSATIONS FANTÔMES WhatsApp d'un compte (PITFALLS #75) :
// avant le correctif, une réponse envoyée depuis Relvo se rangeait dans une
// seconde conversation sur le même fil, que personne n'ouvrait — la réponse
// « disparaissait ». Chaque fantôme se fond dans la conversation du fil par la
// fonction du domaine, et le journal du compte le dit.
//
// Usage : pnpm --filter web wa:reparer <e-mail du compte> [--simuler]
//   --simuler liste sans rien fondre
//
// Tourne sur la base que `DATABASE_URL` désigne : la base locale par défaut,
// la production en pointant la variable sur elle, le temps du geste.
import {
  listerConversationsFantomes,
  prisma,
  reparerConversationsFantomes,
  tenantDb,
} from "@relvo/db";

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith("--")) {
    throw new Error("usage : wa:reparer <e-mail du compte> [--simuler]");
  }
  const simuler = process.argv.includes("--simuler");

  const account = await prisma.account.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const db = tenantDb(account.id);

  const fantomes = simuler
    ? await listerConversationsFantomes(db)
    : await reparerConversationsFantomes(db);
  for (const f of fantomes) {
    console.log(
      `  ${simuler ? "~" : "+"} ${f.cibleTitre} : ${f.messages} message(s) ${simuler ? "à remettre" : "remis"} dans le fil`,
    );
  }
  console.log(
    `${fantomes.length} conversation(s) fantôme(s) ${simuler ? "trouvée(s) (simulation)" : "fondue(s)"} pour ${account.email}.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
