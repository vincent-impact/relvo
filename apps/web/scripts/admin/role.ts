// Donne ou retire le rôle d'administrateur d'un compte (M21.1), par le domaine
// — jamais de SQL direct — et journalisé sur le compte visé.
//
// Usage : pnpm --filter web admin:role <e-mail> admin|ceo
//
// Tourne sur la base que `DATABASE_URL` désigne : la base locale par défaut, la
// production en pointant la variable sur elle, le temps du geste. ⚠️ Le proxy
// lit le rôle dans le jeton de session : le nouveau rôle n'y entre qu'à la
// prochaine connexion du compte.
import { AccountRole, prisma, setAccountRole, tenantDb } from "@relvo/db";

const ROLES = new Set<string>(Object.values(AccountRole));

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !ROLES.has(role)) {
    throw new Error(
      `usage : admin:role <e-mail> ${[...ROLES].join("|")} (reçu : ${process.argv.slice(2).join(" ") || "rien"})`,
    );
  }
  const account = await prisma.account.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const { changed } = await setAccountRole(
    tenantDb(account.id),
    account.id,
    role as AccountRole,
  );
  console.log(
    changed
      ? `${account.email} : rôle « ${role} » posé — effectif à sa prochaine connexion.`
      : `${account.email} : déjà « ${role} », rien à faire.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
