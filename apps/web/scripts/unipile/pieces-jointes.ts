// Rattrape les PIÈCES JOINTES manquantes des e-mails reçus d'un compte
// (recette du 2026-10-21) : pour chaque message entrant sans pièce jointe en
// base, l'e-mail est relu chez l'agrégateur ; s'il en porte, elles sont
// stockées par la même fonction que le webhook et la lecture de l'historique
// (`stockerPiecesJointes`) — jamais un second chemin.
//
// Usage : pnpm --filter web pj:rattraper <e-mail du compte> [--filtre <texte>] [--tout] [--simuler]
//   --filtre  ne regarde que les messages dont l'expéditeur, l'objet ou la
//             conversation contient le texte (ex. kiloutou)
//   --tout    tous les messages, pas seulement ceux des trente derniers jours
//   --simuler compte sans rien stocker
//
// Tourne sur la base que `DATABASE_URL` désigne, avec `UNIPILE_DSN`,
// `UNIPILE_API_KEY` et le stockage du même environnement : la base locale par
// défaut, la production en pointant les variables sur elle, le temps du geste.
import { prisma, tenantDb } from "@relvo/db";
import { stockerPiecesJointes } from "../../src/server/unipile/attachments";
import { getEmail } from "../../src/server/unipile/client";

const JOURS_PAR_DEFAUT = 30;

function arg(nom: string): string | null {
  const i = process.argv.indexOf(nom);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith("--")) {
    throw new Error(
      "usage : pj:rattraper <e-mail du compte> [--filtre <texte>] [--tout] [--simuler]",
    );
  }
  const filtre = arg("--filtre")?.toLowerCase() ?? null;
  const tout = process.argv.includes("--tout");
  const simuler = process.argv.includes("--simuler");

  const account = await prisma.account.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const db = tenantDb(account.id);

  const canaux = await db.channel.findMany({
    where: { type: "email" },
    select: {
      id: true,
      name: true,
      config: { select: { externalAccountId: true } },
    },
  });
  const depuis = tout
    ? undefined
    : new Date(Date.now() - JOURS_PAR_DEFAUT * 24 * 60 * 60 * 1000);
  const messages = await db.message.findMany({
    where: {
      direction: "incoming",
      channelId: { in: canaux.map((c) => c.id) },
      externalId: { not: null },
      attachments: { none: {} },
      ...(depuis ? { createdAt: { gte: depuis } } : {}),
    },
    select: {
      id: true,
      channelId: true,
      externalId: true,
      subjectId: true,
      senderRaw: true,
      subjectLine: true,
      conversation: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const cibles = messages.filter((m) => {
    if (!filtre) return true;
    const texte = [m.senderRaw, m.subjectLine, m.conversation?.title]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return texte.includes(filtre);
  });
  console.log(
    `${account.email} : ${cibles.length} message(s) reçu(s) sans pièce jointe${filtre ? ` contenant « ${filtre} »` : ""}${depuis ? ` depuis ${JOURS_PAR_DEFAUT} jours` : ""}.`,
  );

  let relus = 0;
  let avecPieces = 0;
  let stockees = 0;
  for (const m of cibles) {
    const canal = canaux.find((c) => c.id === m.channelId);
    const unipileAccountId = canal?.config?.externalAccountId;
    if (!unipileAccountId || !m.externalId) continue;
    const complet = await getEmail(m.externalId).catch((e: unknown) => {
      console.warn(
        `  ! ${m.externalId} : ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    });
    relus += 1;
    const pieces = complet?.attachments ?? [];
    if (pieces.length === 0) continue;
    avecPieces += 1;
    const libelle = `${m.senderRaw ?? "?"} — ${m.subjectLine ?? m.conversation?.title ?? "(sans objet)"}`;
    if (simuler) {
      console.log(`  ~ ${libelle} : ${pieces.length} pièce(s) à stocker`);
      continue;
    }
    const n = await stockerPiecesJointes(db, {
      accountId: account.id,
      unipileAccountId,
      emailId: m.externalId,
      messageId: m.id,
      subjectId: m.subjectId,
      attachments: pieces,
    });
    stockees += n;
    console.log(`  + ${libelle} : ${n}/${pieces.length} pièce(s) stockée(s)`);
  }
  console.log(
    `${relus} e-mail(s) relu(s) chez l'agrégateur, ${avecPieces} avec des pièces, ${stockees} pièce(s) stockée(s)${simuler ? " (simulation)" : ""}.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
