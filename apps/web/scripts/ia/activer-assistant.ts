// Active ou désactive l'assistant d'un compte, par le domaine (jamais de SQL
// direct). Usage : node --env-file=.env.local --import tsx scripts/ia/activer-assistant.ts <e-mail> [on|off]
import { prisma, setAssistantEnabled, tenantDb } from "@relvo/db";

async function main() {
  const [email, etat = "on"] = process.argv.slice(2);
  if (!email) throw new Error("e-mail attendu");
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  await setAssistantEnabled(tenantDb(account.id), account.id, etat !== "off");
  console.log(
    `${email} : assistant ${etat !== "off" ? "activé" : "désactivé"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
