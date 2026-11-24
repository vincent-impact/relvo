// LE STOCK DES GROUPES DÉJÀ CONNUS (M29.3) — juge, une fois, chaque groupe
// WhatsApp que Relvo n'a jamais jugé : de quoi relève-t-il ? Hors du champ
// professionnel et sans aucun doute, il est IGNORÉ avec sa raison (et ignorer,
// c'est ne plus importer) ; sinon il reste, avec l'avis de Relvo. Un groupe
// nouveau, lui, se juge tout seul à son premier message.
//
// Usage : pnpm --filter web groupes:juger [<e-mail>] [--executer] [--titres] [--limite N] [--differe]
//
// SANS `--executer`, c'est une SIMULATION : le modèle juge, rien n'est écrit,
// et le script dit ce qu'il ferait, compte par compte. `--titres` liste chaque
// groupe avec son verdict — à réserver à son propre compte. `--differe` passe
// les appels au tarif différé (moitié prix, bien plus lent).
//
// Tourne sur la base que `DATABASE_URL` désigne : la base locale par défaut, la
// production en pointant la variable sur elle, le temps du geste. Réversible :
// un groupe ignoré se réactive d'un appui ; ce qu'il aura reçu entre-temps se
// relit au retour (M25.10), sans ses photos.
import { prisma } from "@relvo/db";
import { jugerLeGroupe } from "../../src/server/ia/pipeline/groupe-jugement";

const DE_FRONT = 4;

async function main() {
  const args = process.argv.slice(2);
  const executer = args.includes("--executer");
  const titres = args.includes("--titres");
  const differe = args.includes("--differe");
  const iLimite = args.indexOf("--limite");
  const limite = iLimite >= 0 ? Number(args[iLimite + 1]) : Infinity;
  const email = args
    .find((a, i) => !a.startsWith("--") && args[i - 1] !== "--limite")
    ?.trim()
    .toLowerCase();

  const comptes = await prisma.account.findMany({
    where: {
      assistantEnabled: true,
      isActive: true,
      ...(email ? { email } : {}),
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (email && comptes.length === 0)
    throw new Error(`compte inconnu, ou assistant coupé : ${email}`);

  console.log(
    executer
      ? "JUGEMENT — les groupes hors du champ professionnel sont ignorés."
      : "SIMULATION — rien n'est écrit. Ajoutez --executer pour appliquer.",
  );

  const total = new Map<string, number>();
  let cout = 0;
  let restant = limite;
  for (const compte of comptes) {
    if (restant <= 0) break;
    const groupes = await prisma.conversation.findMany({
      where: {
        accountId: compte.id,
        type: "whatsapp_group",
        status: "active",
        triagedAt: null,
      },
      select: { id: true, title: true },
      orderBy: [{ lastMessageAt: "desc" }, { id: "asc" }],
      take: Number.isFinite(restant) ? restant : undefined,
    });
    if (groupes.length === 0) continue;
    restant -= groupes.length;

    const duCompte = new Map<string, number>();
    for (let i = 0; i < groupes.length; i += DE_FRONT) {
      await Promise.all(
        groupes.slice(i, i + DE_FRONT).map(async (g) => {
          const r = await jugerLeGroupe({
            accountId: compte.id,
            conversationId: g.id,
            lot: differe,
            simuler: !executer,
          });
          cout += r.coutEur;
          const cle = r.groupe
            ? `${r.groupe.ignore ? "ignoré" : "gardé"} · ${r.groupe.nature} · confiance ${r.groupe.confiance}`
            : `non jugé (${r.issue})`;
          duCompte.set(cle, (duCompte.get(cle) ?? 0) + 1);
          total.set(cle, (total.get(cle) ?? 0) + 1);
          if (titres)
            console.log(
              `    ${cle} — « ${g.title} »${r.groupe ? ` — ${r.groupe.raison}` : ""}`,
            );
        }),
      );
    }
    console.log(`  ${compte.email} — ${groupes.length} groupe(s)`);
    for (const [cle, n] of [...duCompte].sort())
      console.log(`      ${n} × ${cle}`);
  }

  console.log("\nTOTAL");
  for (const [cle, n] of [...total].sort()) console.log(`  ${n} × ${cle}`);
  console.log(`Coût des appels : ${cout.toFixed(3)} €`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
