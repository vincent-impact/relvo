// Propose la MIGRATION d'une boîte de l'agrégateur vers le relais Gmail
// (M24.9) : Relvo pose la question au dirigeant — relier la boîte à nouveau,
// avec Google — et la pousse (M12.9). Rien ne bascule ici : la boîte continue
// par l'agrégateur tant que le dirigeant n'a pas fait le geste ; c'est le
// retour du consentement qui la fait passer, sans relire les quatorze jours,
// puis efface l'ancien compte chez l'agrégateur. Par le domaine, journalisé —
// jamais de SQL direct.
//
// Usage : pnpm --filter web boites:migrer <e-mail du compte> [adresse de la boîte]
//
// Tourne sur la base que `DATABASE_URL` désigne : la base locale par défaut, la
// production en pointant la variable sur elle, le temps du geste.
import { prisma, proposeGmailMigration, tenantDb } from "@relvo/db";
import { notifierQuestion } from "../../src/server/push/questions";

async function main() {
  const [email, adresse] = process.argv.slice(2);
  if (!email) {
    throw new Error(
      "usage : boites:migrer <e-mail du compte> [adresse de la boîte]",
    );
  }
  const account = await prisma.account.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const db = tenantDb(account.id);

  const boites = await db.channel.findMany({
    where: {
      type: "email",
      config: { provider: "unipile", externalAccountId: { not: null } },
    },
    select: { id: true, identifier: true },
    orderBy: { createdAt: "asc" },
  });
  if (boites.length === 0) {
    console.log(
      `${account.email} : aucune boîte e-mail par l'agrégateur, rien à migrer.`,
    );
    return;
  }
  const cible = adresse
    ? boites.find(
        (b) =>
          b.identifier.trim().toLowerCase() === adresse.trim().toLowerCase(),
      )
    : boites.length === 1
      ? boites[0]
      : null;
  if (!cible) {
    throw new Error(
      adresse
        ? `${account.email} : aucune boîte « ${adresse} » par l'agrégateur. Boîtes : ${boites.map((b) => b.identifier).join(", ")}`
        : `${account.email} : plusieurs boîtes par l'agrégateur, précisez l'adresse : ${boites.map((b) => b.identifier).join(", ")}`,
    );
  }

  const { question, deja, identifier } = await proposeGmailMigration(
    db,
    cible.id,
  );
  if (deja) {
    console.log(
      `${account.email} : la migration de ${identifier} est déjà proposée (question ${question.id}).`,
    );
    return;
  }
  const bilan = await notifierQuestion(account.id, {
    id: question.id,
    text: question.text,
  });
  console.log(
    `${account.email} : migration de ${identifier} proposée (question ${question.id}) · push`,
    bilan,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
