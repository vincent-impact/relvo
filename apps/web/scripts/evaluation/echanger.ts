// LE JEU D'ÉVALUATION DE L'ÉCHANGE (M10, tranche 5) : des questions du
// dirigeant, l'outil attendu et ses arguments, le tier attendu — et pour
// chaque tour, l'outil réellement appelé, le tier choisi, le coût, le cache lu
// (PITFALLS.md #49). Même discipline que les autres jeux de M7.17 : ça se
// rejoue, ça se compare, ça ne s'estime pas.
//
// Tourne HORS Next, sur la base que `DATABASE_URL` désigne, contre le vrai
// modèle — chaque cas coûte un tour. Les écritures (une tâche, une instruction)
// sont RÉELLES sur le compte visé : le compte de démonstration par défaut.
//
// Usage :
//   pnpm --filter web eval:echange [--compte demo@tastycrousty.fr] [--cas E1,E5] [--jeu jeu/echange/cas.jsonl] [--reponses]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  prisma,
  tenantDb,
  jourDecale,
  jourParis,
  type TenantDb,
} from "@relvo/db";
import type { ToolSet } from "ai";
import { chat } from "../../src/server/ia/client";
import { NIVEAU_RETENU } from "../../src/server/ia/config";
import { construireTour } from "../../src/server/ia/echange/construire";
import type { RelvoUIMessage } from "../../src/server/ia/echange/outils";
import { arg } from "./commun";

type Cas = {
  id: string;
  question: string;
  from: string;
  attendu: {
    outil?: string | string[];
    args?: Record<string, unknown>;
    tier?: "extraction" | "raisonnement";
  };
};

function lireCas(chemin: string): Cas[] {
  return readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Cas);
}

/** « {{lundi}} », « {{demain}} », « {{sujet:DDPP}} » → des valeurs du jour et du compte. */
async function resoudre(
  db: TenantDb,
  texte: string,
  now: Date,
): Promise<string> {
  let out = texte;
  const prochainLundi = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = jourDecale(now, i);
      if (d.getUTCDay() === 1) return d.toISOString().slice(0, 10);
    }
    return "";
  })();
  out = out.replace(/\{\{lundi\}\}/g, prochainLundi);
  out = out.replace(
    /\{\{demain\}\}/g,
    jourDecale(now, 1).toISOString().slice(0, 10),
  );
  for (const m of out.matchAll(/\{\{sujet:([^}]+)\}\}/g)) {
    const s = await db.subject.findFirst({
      where: { title: { contains: m[1]!, mode: "insensitive" } },
      select: { id: true },
    });
    out = out.replace(m[0], s?.id ?? "introuvable");
  }
  return out;
}

function correspond(attendu: unknown, recu: unknown): boolean {
  if (typeof attendu === "string" && attendu.startsWith("~")) {
    return (
      typeof recu === "string" &&
      recu.toLowerCase().includes(attendu.slice(1).toLowerCase())
    );
  }
  return JSON.stringify(attendu) === JSON.stringify(recu);
}

async function main() {
  const email = arg("compte", "demo@tastycrousty.fr");
  const filtre = arg("cas", "");
  const jeu = resolve(import.meta.dirname, arg("jeu", "jeu/echange/cas.jsonl"));
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) throw new Error(`compte inconnu : ${email}`);
  const db = tenantDb(account.id);
  const now = new Date();
  const cas = lireCas(jeu).filter(
    (c) => !filtre || filtre.split(",").includes(c.id),
  );

  console.log(
    `# Jeu d'évaluation de l'échange — ${email} — ${jourParis(now)} — ${cas.length} cas\n`,
  );
  console.log(
    "| cas | question | outil attendu | outil appelé | args | tier attendu | tier | € | cache lu | ms |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|");

  let ok = 0;
  let total = 0;
  for (const c of cas) {
    const question = await resoudre(db, c.question, now);
    const from = await resoudre(db, c.from, now);
    const messages: RelvoUIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: question }] },
    ];
    const tour = await construireTour(
      db,
      { accountId: account.id, messages, from, general: false },
      {
        now,
        // Hors Next, pas de pipeline de brouillon : un simulacre qui le dit.
        brouillon: async () => ({ issue: "echec", detail: "jeu d'évaluation" }),
      },
    );
    // Les appels d'outils observés : chaque `execute` est enveloppé.
    const appels: { nom: string; args: unknown }[] = [];
    const outils = Object.fromEntries(
      Object.entries(tour.outils as Record<string, object>).map(
        ([nom, outil]) => [
          nom,
          {
            ...outil,
            execute: async (args: unknown, options: unknown) => {
              appels.push({ nom, args });
              return (
                outil as {
                  execute: (a: unknown, o: unknown) => Promise<unknown>;
                }
              ).execute(args, options);
            },
          },
        ],
      ),
    ) as unknown as ToolSet;
    const { flux, mesure } = chat({
      sollicitation: "banc-essai",
      system: tour.contexte.system,
      messages: tour.modelMessages,
      tools: outils,
      tier: tour.tier,
      reasoning: NIVEAU_RETENU[tour.tier],
      cacheCle: account.id,
      prefixeStable: tour.prefixeStable,
    });
    await flux.consumeStream();
    const m = await mesure;

    const attendus = c.attendu.outil
      ? Array.isArray(c.attendu.outil)
        ? c.attendu.outil
        : [c.attendu.outil]
      : [];
    const premier = appels[0];
    const outilOk =
      attendus.length === 0 ||
      (premier !== undefined && attendus.includes(premier.nom));
    const argsAttendus = c.attendu.args
      ? await resoudre(db, JSON.stringify(c.attendu.args), now).then(
          (s) => JSON.parse(s) as Record<string, unknown>,
        )
      : null;
    const argsOk =
      !argsAttendus ||
      (premier !== undefined &&
        Object.entries(argsAttendus).every(([k, v]) =>
          correspond(v, (premier.args as Record<string, unknown>)[k]),
        ));
    const tierOk = !c.attendu.tier || c.attendu.tier === tour.tier;
    const reussi = outilOk && argsOk && tierOk;
    total++;
    if (reussi) ok++;
    // Les arguments réellement passés se lisent toujours : c'est eux qui
    // disent pourquoi un outil n'a rien trouvé.
    const argsVus = appels
      .map((a) => JSON.stringify(a.args).slice(0, 60))
      .join(" → ");
    console.log(
      `| ${c.id} ${reussi ? "✅" : "❌"} | ${question.slice(0, 48)} | ${attendus.join(" ou ") || "—"} | ${appels.map((a) => a.nom).join(" → ") || "aucun"} | ${argsOk ? argsVus || "—" : `≠ ${argsVus}`} | ${c.attendu.tier ?? "—"} | ${tour.tier} | ${m.cout.eur.toFixed(4)} | ${m.jetons.cacheLecture}/${tour.prefixeStable} | ${m.dureeMs} |`,
    );
    if (process.argv.includes("--reponses")) {
      console.log(
        `  ↳ ${(await flux.text).replace(/\s+/g, " ").slice(0, 300)}`,
      );
    }
  }
  console.log(`\n${ok}/${total} cas réussis.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
