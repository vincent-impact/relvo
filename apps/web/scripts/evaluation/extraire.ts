// Extraction d'un JEU D'ÉVALUATION depuis la base (M7.17, tranche 1).
//
// La vérité terrain, c'est le tri déjà fait à la main : une conversation
// e-mail qui porte un sujet est une « affaire », avec son domaine, son titre et
// ses tâches ; une conversation ignorée ou sans sujet est du « bruit ». Le
// script sort deux fichiers dans `jeu/<nom>/` : `compte.json` (le contexte du
// compte au moment de l'extraction) et `cas.jsonl` (un cas par ligne).
//
// ⚠️ Anonymisation : adresses e-mail, téléphones et IBAN sont remplacés de
// façon STABLE (même adresse → même pseudonyme) dans tous les champs. Les
// noms de personnes ne sont PAS détectés automatiquement : une relecture
// humaine du fichier est obligatoire avant tout commit d'un jeu réel.
//
// Usage :
//   node --env-file=.env.local --import tsx scripts/evaluation/extraire.ts \
//     --compte demo@tastycrousty.fr --nom demo [--secteurs food,batiment]

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@relvo/db";
import type { Cas, CompteEvaluation } from "./types";

function compteNom(): string {
  return "Entreprise";
}

function arg(nom: string, defaut?: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v && defaut === undefined) {
    console.error(`argument --${nom} manquant`);
    process.exit(1);
  }
  return v ?? defaut!;
}

const pseudonymes = new Map<string, string>();
function pseudo(
  valeur: string,
  prefixe: string,
  domaine = "exemple.fr",
): string {
  const cle = valeur.toLowerCase();
  let p = pseudonymes.get(cle);
  if (!p) {
    const h = createHash("sha256").update(cle).digest("hex").slice(0, 6);
    p = prefixe === "mail" ? `${prefixe}-${h}@${domaine}` : `${prefixe}-${h}`;
    pseudonymes.set(cle, p);
  }
  return p;
}

export function anonymiser(texte: string): string {
  return texte
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) =>
      pseudo(m, "mail"),
    )
    .replace(/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){3,7}\b/g, () => "IBAN-masqué")
    .replace(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g, (m) => pseudo(m, "tel"));
}

/** « Prénom Nom (Entreprise) <adresse> », à partir de ce que le message et le contact portent. */
function expediteur(m: {
  senderName: string | null;
  senderRaw: string | null;
  senderContact: {
    firstName: string | null;
    lastName: string;
    company: string | null;
    email: string | null;
  } | null;
}): string {
  const c = m.senderContact;
  const nom =
    m.senderName ??
    (c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : null);
  const adresse = m.senderRaw ?? c?.email ?? null;
  const entreprise = c?.company ? ` (${c.company})` : "";
  if (!nom && !adresse) return "inconnu";
  return `${nom ?? ""}${entreprise}${adresse ? ` <${adresse}>` : ""}`.trim();
}

async function main() {
  const email = arg("compte");
  const nom = arg("nom");
  const secteurs = arg("secteurs", "food").split(","); // valeurs de l'énuméré Sector : food, construction, other
  const entreprise = arg("entreprise", `${compteNom()}`);

  const compte = await prisma.account.findUniqueOrThrow({ where: { email } });
  const domaines = await prisma.folder.findMany({
    where: { accountId: compte.id, isActive: true },
    orderBy: { name: "asc" },
  });
  const sujetsOuverts = await prisma.subject.findMany({
    where: { accountId: compte.id, status: "open" },
    orderBy: { reference: "asc" },
    select: { reference: true, title: true },
  });
  const conversations = await prisma.conversation.findMany({
    where: { accountId: compte.id, type: "email_subject" },
    include: {
      messages: {
        where: { direction: "incoming" },
        orderBy: { receivedAt: "asc" },
        include: { senderContact: true },
      },
      subjects: {
        include: {
          subject: {
            include: { folder: true, tasks: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
    orderBy: { lastMessageAt: "asc" },
  });

  const dossier = resolve(import.meta.dirname, "jeu", nom);
  mkdirSync(dossier, { recursive: true });

  const compteEval: CompteEvaluation = {
    entreprise,
    secteurs: secteurs as CompteEvaluation["secteurs"],
    domaines: domaines.map((d) => ({
      nom: d.name,
      description: d.description,
    })),
    sujetsOuverts: sujetsOuverts.map((s) => ({
      reference: s.reference,
      titre: anonymiser(s.title),
    })),
  };
  writeFileSync(
    resolve(dossier, "compte.json"),
    JSON.stringify(compteEval, null, 2) + "\n",
  );

  const cas: Cas[] = [];
  for (const c of conversations) {
    if (c.messages.length === 0) continue;
    const sujet = c.subjects[0]?.subject;
    cas.push({
      id: `${nom}-${String(cas.length + 1).padStart(3, "0")}`,
      canal: "email",
      messages: c.messages.map((m) => ({
        expediteur: anonymiser(expediteur(m)),
        recuLe: (m.receivedAt ?? m.createdAt).toISOString(),
        objet: m.subjectLine ? anonymiser(m.subjectLine) : null,
        contenu: anonymiser(m.content ?? ""),
      })),
      verite: {
        verdict: c.status === "ignored" || !sujet ? "bruit" : "affaire",
        reference: sujet?.reference ?? null,
        domaine: sujet?.folder?.name ?? null,
        titre: sujet ? anonymiser(sujet.title) : null,
        priorite: sujet?.priority ?? null,
        taches: (sujet?.tasks ?? []).map((t) => ({
          titre: anonymiser(t.title),
          type: t.kind,
          date: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
        })),
      },
    });
  }
  writeFileSync(
    resolve(dossier, "cas.jsonl"),
    cas.map((x) => JSON.stringify(x)).join("\n") + "\n",
  );
  const affaires = cas.filter((x) => x.verite.verdict === "affaire").length;
  console.log(
    `${cas.length} cas écrits dans ${dossier} — ${affaires} affaires, ${cas.length - affaires} bruit, ${domaines.length} domaines, ${sujetsOuverts.length} sujets ouverts.`,
  );
  console.log(
    "⚠️ Relire le fichier avant de le commiter : les noms de personnes ne sont pas anonymisés automatiquement.",
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
