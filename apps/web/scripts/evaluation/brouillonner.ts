// LANCEUR du jeu d'évaluation (M7.17) — le BROUILLON, hors application.
//
// Pour chaque cas « à traiter » du jeu qui attend une tâche de réponse ou de
// décision, rédige le brouillon comme à l'appui sur « Répondre » — fiche du
// sujet, tâche, derniers messages — et mesure : longueur, coût en euros,
// latence, cache. Pas d'accord à mesurer ici : un brouillon se juge à la
// lecture. Le rapport imprime chaque texte pour ça.
//
// Usage :
//   node --env-file=.env.local --import tsx scripts/evaluation/brouillonner.ts \
//     --jeu demo [--configs gpt-5.6-luna:low] [--parallele 4] [--limite 5]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { draft, type Sollicitation } from "../../src/server/ia/client";
import type { NiveauRaisonnement } from "../../src/server/ia/config";
import { contexteBrouillon } from "../../src/server/ia/contexte";
import { SortieBrouillon } from "../../src/server/ia/schemas";
import type { MesureSollicitation } from "../../src/server/ia/tarifs";
import type { Cas, CompteEvaluation } from "./types";

function arg(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? (process.argv[i + 1] ?? defaut) : defaut;
}

type Config = { modele: string; niveau: NiveauRaisonnement };
type Resultat = {
  cas: string;
  tache: string;
  texte: string | null;
  /** Ce que le modèle cite — vide sur la démonstration, qui n'a ni instruction ni document. */
  sources: string[];
  erreur: string | null;
  mesure: MesureSollicitation | null;
};

async function enParallele<T, R>(
  items: T[],
  n: number,
  f: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await f(items[k]);
      }
    }),
  );
  return out;
}

async function brouillonner(
  compte: CompteEvaluation,
  cas: Cas,
  tache: { titre: string; type: string; date: string | null },
  config: Config,
): Promise<Resultat> {
  const premier = cas.messages[0];
  const dernier = cas.messages[cas.messages.length - 1];
  const { system, prompt } = contexteBrouillon({
    compte: { ...compte, sujetsOuverts: [] },
    domaine: null,
    sujet: {
      reference: cas.verite.reference ?? "SUB-NOUVEAU",
      titre: cas.verite.titre ?? premier.objet ?? "Sujet",
      domaine: cas.verite.domaine,
      etiquettes: [],
      statut: "ouvert",
      priorite: cas.verite.priorite ?? "normal",
      enAttente: false,
      ouvertLe: premier.recuLe,
      situation: {
        ouOnEnEst: null,
        prochaineEtape: null,
        attente: null,
        echeance: null,
      },
      resume: null,
      taches: [{ ...tache, source: "relvo" }],
      contacts: [],
      messages: cas.messages,
    },
    contact: null,
    tache: { ...tache, source: "relvo" },
    instant: { maintenant: dernier.recuLe },
  });
  try {
    const { sortie, mesure } = await draft({
      sollicitation: "banc-essai" satisfies Sollicitation,
      schema: SortieBrouillon,
      nomSchema: "brouillon_de_reponse",
      system,
      prompt,
      reasoning: config.niveau,
      modele: config.modele,
    });
    return {
      cas: cas.id,
      tache: tache.titre,
      texte: sortie.texte,
      sources: sortie.sources,
      erreur: null,
      mesure,
    };
  } catch (e) {
    return {
      cas: cas.id,
      tache: tache.titre,
      texte: null,
      sources: [],
      erreur: e instanceof Error ? e.message.slice(0, 200) : String(e),
      mesure: null,
    };
  }
}

function moy(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

async function main() {
  const jeu = arg("jeu", "demo");
  const limite = Number(arg("limite", "0"));
  const parallele = Number(arg("parallele", "4"));
  const configs: Config[] = arg("configs", "gpt-5.6-luna:low")
    .split(",")
    .map((c) => {
      const [modele, niveau] = c.split(":");
      return { modele, niveau: niveau as NiveauRaisonnement };
    });
  const dossier = resolve(import.meta.dirname, "jeu", jeu);
  const compte = JSON.parse(
    readFileSync(resolve(dossier, "compte.json"), "utf8"),
  ) as CompteEvaluation;
  let paires = readFileSync(resolve(dossier, "cas.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cas)
    .filter((c) => c.verite.action === "a_traiter")
    .flatMap((c) =>
      c.verite.taches
        .filter((t) => t.type === "reply" || t.type === "decision")
        .slice(0, 1)
        .map((t) => ({ cas: c, tache: t })),
    );
  if (limite > 0) paires = paires.slice(0, limite);
  console.log(`Jeu « ${jeu} » : ${paires.length} brouillons à rédiger.\n`);

  for (const config of configs) {
    const cle = `${config.modele}:${config.niveau}`;
    const debut = Date.now();
    const resultats = await enParallele(paires, parallele, (p) =>
      brouillonner(compte, p.cas, p.tache, config),
    );
    const ok = resultats.filter((r) => r.mesure);
    const mesures = ok.map((r) => r.mesure!);
    const coutMoyen = moy(mesures.map((m) => m.cout.eur));
    console.log(`=== ${cle} — ${((Date.now() - debut) / 1000).toFixed(0)} s`);
    console.log(`  erreurs               : ${resultats.length - ok.length}`);
    console.log(
      `  longueur moy. (car.)  : ${Math.round(moy(ok.map((r) => r.texte!.length)))}`,
    );
    console.log(
      `  coût moyen            : ${coutMoyen.toFixed(5)} € → ${(coutMoyen * 1000).toFixed(2)} € / 1 000 brouillons`,
    );
    console.log(
      `  latence moyenne       : ${(moy(mesures.map((m) => m.dureeMs)) / 1000).toFixed(1)} s`,
    );
    console.log(
      `  jetons entrée (dont relus en cache) : ${Math.round(moy(mesures.map((m) => m.jetons.entree + m.jetons.cacheLecture + m.jetons.cacheEcriture)))} (${Math.round(moy(mesures.map((m) => m.jetons.cacheLecture)))})`,
    );
    console.log(
      `  jetons sortie (raison.) : ${Math.round(moy(mesures.map((m) => m.jetons.sortie)))} (${Math.round(moy(mesures.map((m) => m.jetons.raisonnement)))})`,
    );
    for (const r of resultats) {
      console.log(
        `\n  · ${r.cas} — ${r.tache}${r.erreur ? ` — ERREUR ${r.erreur}` : ""}`,
      );
      if (r.texte) console.log(r.texte.replace(/^/gm, "      "));
      if (r.sources.length) {
        console.log(`      Basé sur : ${r.sources.join(", ")}`);
      }
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
