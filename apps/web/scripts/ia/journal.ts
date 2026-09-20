// LE COMPTEUR RELU (M7.13, M7.16 — tranche 8) : ce que le journal de Relvo
// dit de l'inférence, par sollicitation — appels, euros, jetons, latence — et
// le CACHE confronté à ce qu'il aurait dû relire. Un appel « silencieux » est
// un appel dont le préfixe stable était en cache quelques minutes plus tôt et
// n'a pas été relu : c'est le signe d'un octet qui bouge là où rien ne devrait
// bouger (PITFALLS.md #49), et il ne se voit que d'ici.
//
// Lecture seule, par le domaine (`listAiSolicitations`,
// `summarizeAiSolicitations`). Tourne sur la base que `DATABASE_URL` désigne :
// la base locale par défaut ; la production en pointant la variable sur elle,
// le temps du rapport.
//
// Usage :
//   pnpm --filter web ia:journal [--compte <e-mail>] [--jours 7] [--silencieux 10]
//
// Sans `--compte`, tous les comptes, l'un après l'autre.

import {
  AI_CACHE_SILENT_RATIO,
  AI_CACHE_WINDOW_MS,
  listAiSolicitations,
  prisma,
  summarizeAiSolicitations,
  tenantDb,
} from "@relvo/db";
import { arg } from "../evaluation/commun";

function eur(n: number): string {
  return `${n.toFixed(4)} €`;
}
function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)} %`;
}
function quand(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

async function main() {
  const email = arg("compte", "");
  const jours = Number(arg("jours", "7"));
  const maxSilencieux = Number(arg("silencieux", "10"));
  const since = new Date(Date.now() - jours * 86_400_000);

  const comptes = await prisma.account.findMany({
    where: email ? { email } : {},
    select: { id: true, email: true, assistantEnabled: true },
    orderBy: { email: "asc" },
  });
  if (comptes.length === 0) {
    console.error(email ? `Aucun compte « ${email} ».` : "Aucun compte.");
    process.exit(1);
  }

  console.log(
    `Journal de l'inférence — ${jours} jour${jours > 1 ? "s" : ""} (depuis le ${quand(since)} UTC) · fenêtre de cache ${AI_CACHE_WINDOW_MS / 60_000} min · silencieux sous ${Math.round(AI_CACHE_SILENT_RATIO * 100)} % du préfixe\n`,
  );

  let totalEur = 0;
  for (const compte of comptes) {
    const lignes = await listAiSolicitations(tenantDb(compte.id), { since });
    const synthese = summarizeAiSolicitations(lignes);
    const coutCompte = synthese.reduce((s, x) => s + x.coutEur, 0);
    totalEur += coutCompte;
    console.log(
      `## ${compte.email}${compte.assistantEnabled ? "" : " (assistant coupé)"} — ${lignes.length} appel${lignes.length > 1 ? "s" : ""}, ${eur(coutCompte)}`,
    );
    if (lignes.length === 0) {
      console.log("");
      continue;
    }
    console.log(
      `\n| sollicitation | appels | € | €/appel | entrée moy. | cache lu | cache attendu | relu / attendu | sortie moy. (dont raisonnement) | latence moy. | silencieux |`,
    );
    console.log(`|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const s of synthese) {
      console.log(
        `| ${s.sollicitation} | ${s.appels} | ${eur(s.coutEur)} | ${eur(s.coutEur / s.appels)} | ${Math.round(s.entree / s.appels)} | ${Math.round(s.cacheLecture / s.appels)} | ${s.mesures ? Math.round(s.prefixeStable / s.mesures) : "—"} | ${s.mesures ? pct(s.cacheLectureMesuree, s.prefixeStable) : "—"} | ${Math.round(s.sortie / s.appels)} (${Math.round(s.raisonnement / s.appels)}) | ${s.dureeMsMoyenne} ms | ${s.mesures ? `${s.silencieux.length}/${s.mesures}` : "non mesuré"} |`,
      );
    }
    const silencieux = synthese
      .flatMap((s) => s.silencieux)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (silencieux.length) {
      console.log(`\nSilencieux (${silencieux.length}) :`);
      for (const r of silencieux.slice(0, maxSilencieux)) {
        console.log(
          `- ${quand(r.at)} · ${r.sollicitation} · ${r.jetons.cacheLecture} relus sur ${r.prefixeStable} attendus · ${r.modele}${r.reponseId ? ` · ${r.reponseId}` : ""}${r.subjectId ? ` · sujet ${r.subjectId}` : ""}`,
        );
      }
      if (silencieux.length > maxSilencieux) {
        console.log(`- … et ${silencieux.length - maxSilencieux} de plus.`);
      }
    }
    const nonMesures = lignes.filter((l) => l.prefixeStable === null).length;
    if (nonMesures) {
      console.log(
        `\n${nonMesures} appel${nonMesures > 1 ? "s" : ""} sans préfixe mesuré (antérieurs à la tranche 8, ou brouillons).`,
      );
    }
    console.log("");
  }
  if (comptes.length > 1) console.log(`Total : ${eur(totalEur)}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
