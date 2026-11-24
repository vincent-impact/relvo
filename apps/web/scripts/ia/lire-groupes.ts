// CE QUE LA LECTURE DES GROUPES FERAIT (M29.5) — une SIMULATION, toujours : le
// modèle lit ce qui s'est dit dans chaque groupe sur les dernières heures et
// dit ce qu'il en ferait (ouvrir un sujet, rattacher, ne rien faire, avancer
// vers l'ignorance). RIEN n'est écrit, aucun repère ne bouge. Sert à mesurer,
// avant ou après la mise en route, ce que les deux lectures du jour pèsent sur
// un compte : combien de sujets, à quel coût.
//
// Usage : pnpm --filter web groupes:lire [<e-mail>] [--heures N] [--titres] [--limite N]
//
// `--heures` (12 par défaut) : la fenêtre simulée — la vraie lecture, elle,
// part du repère de chaque groupe. `--titres` liste chaque groupe avec ce que
// Relvo en ferait — à réserver à son propre compte. La vraie lecture ne se
// lance pas d'ici : ce sont les deux crons, ou
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" <app>/api/groupes/lecture
//
// Tourne sur la base que `DATABASE_URL` désigne ; un accès en lecture suffit.
// Les appels partent au tarif immédiat (une simulation n'attend pas) : la
// vraie lecture, au tarif différé, coûte la moitié.
import { prisma } from "@relvo/db";
import { lireLeGroupe } from "../../src/server/ia/pipeline/groupe-lecture";

const DE_FRONT = 4;

async function main() {
  const args = process.argv.slice(2);
  const titres = args.includes("--titres");
  const valeur = (nom: string, defaut: number) => {
    const i = args.indexOf(nom);
    return i >= 0 ? Number(args[i + 1]) : defaut;
  };
  const heures = valeur("--heures", 12);
  const limite = valeur("--limite", Infinity);
  const email = args
    .find(
      (a, i) =>
        !a.startsWith("--") && !["--heures", "--limite"].includes(args[i - 1]!),
    )
    ?.trim()
    .toLowerCase();
  const depuis = new Date(Date.now() - heures * 3_600_000);

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
    `SIMULATION — ce que Relvo ferait des groupes qui ont parlé depuis ${heures} h. Rien n'est écrit.`,
  );

  const total = new Map<string, number>();
  let cout = 0;
  let lus = 0;
  let messages = 0;
  let restant = limite;
  for (const compte of comptes) {
    if (restant <= 0) break;
    const groupes = await prisma.conversation.findMany({
      where: {
        accountId: compte.id,
        type: "whatsapp_group",
        status: "active",
        subjects: { none: { closingMessageId: null } },
        messages: {
          some: {
            direction: "incoming",
            subjectId: null,
            createdAt: { gt: depuis },
          },
        },
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
          const r = await lireLeGroupe({
            accountId: compte.id,
            conversationId: g.id,
            depuis,
            luJusqua: null,
            lot: false,
            simuler: true,
          });
          cout += r.coutEur;
          const l = r.lecture;
          if (l) {
            lus += 1;
            messages += l.messages;
          }
          const cle = l
            ? `${l.suite}${l.versIgnorance ? " (vers l'ignorance)" : ""} · ${l.action} · ${l.nature} · confiance ${l.confiance}`
            : `non lu (${r.issue}${r.detail ? ` : ${r.detail}` : ""})`;
          duCompte.set(cle, (duCompte.get(cle) ?? 0) + 1);
          total.set(cle, (total.get(cle) ?? 0) + 1);
          if (titres)
            console.log(
              `    ${cle} — « ${g.title} »${l ? ` — ${l.messages} message(s)${l.titre ? ` — sujet « ${l.titre} »` : ""} — ${l.raison}` : ""}`,
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
  console.log(
    `${lus} groupe(s) lu(s), ${messages} message(s) montré(s). Coût des appels : ${cout.toFixed(3)} € au tarif immédiat.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
