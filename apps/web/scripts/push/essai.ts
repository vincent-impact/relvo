// Pose une question de test sur un compte et la POUSSE (M12.9) — ce qui permet
// de vérifier la notification d'une question avant que le tri et le rattrapage
// n'en posent. Par le domaine, jamais de SQL direct ; la question se répond ou
// s'écarte ensuite dans l'échange, comme n'importe laquelle.
// Usage : pnpm --filter web push:essai <e-mail> [texte]
import { askQuestion, prisma, tenantDb } from "@relvo/db";
import { notifierQuestion } from "../../src/server/push/questions";

async function main() {
  const [email, texte = "Narbonne est-il un de vos établissements ?"] =
    process.argv.slice(2);
  if (!email) throw new Error("e-mail attendu");
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const db = tenantDb(account.id);
  const question = await askQuestion(db, {
    scope: "account",
    text: texte,
    proposedAnswers: [
      { key: "oui", label: "Oui, c'est à moi" },
      { key: "franchise", label: "Une franchise" },
      { key: "non", label: "Non, un client" },
    ],
  });
  const bilan = await notifierQuestion(account.id, {
    id: question.id,
    text: question.text,
  });
  console.log(`${email} : question ${question.id} posée · push`, bilan);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
