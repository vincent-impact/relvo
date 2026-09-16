// LANCEUR du jeu d'évaluation (M7.17) — la STRUCTURATION, hors application.
//
// Pour chaque configuration (modèle × niveau de raisonnement), structure
// chaque cas « à traiter » du jeu comme si le tri venait d'ouvrir le sujet —
// titre et domaine de la vérité terrain, aucun précédent, aucune instruction
// (le compte de démonstration n'en a pas) — et mesure : tâches proposées
// contre tâches attendues, sujets SANS tâche quand le message est informatif,
// dates posées, coût en euros, latence, jetons de raisonnement, cache.
//
// La question de la tranche 5 : Relvo sait-il ne rien proposer quand il n'y a
// rien à faire (05 §2.2) ? Un jeu qui ne porte que des sujets à tâches ne
// peut pas y répondre : le rapport dit combien de cas informatifs il contient.
//
// Usage :
//   node --env-file=.env.local --import tsx scripts/evaluation/structurer.ts \
//     --jeu demo [--configs gpt-5.6-luna:low,gpt-5.6-luna:none] \
//     [--parallele 4] [--sortie /chemin/rapport.json] [--limite 5]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extract, type Sollicitation } from "../../src/server/ia/client";
import type { NiveauRaisonnement } from "../../src/server/ia/config";
import { contexteStructuration } from "../../src/server/ia/contexte";
import {
  retenirProposition,
  type PropositionRetenue,
} from "../../src/server/ia/pipeline/proposition";
import { SortieStructuration } from "../../src/server/ia/schemas";
import type { MesureSollicitation } from "../../src/server/ia/tarifs";
import type { Cas, CompteEvaluation } from "./types";

function arg(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? (process.argv[i + 1] ?? defaut) : defaut;
}

type Config = { modele: string; niveau: NiveauRaisonnement };
type Resultat = {
  cas: string;
  retenue: PropositionRetenue | null;
  erreur: string | null;
  mesure: MesureSollicitation | null;
  attendues: number;
  proposees: number;
  /** Cas informatif (aucune tâche attendue) : Relvo n'en a-t-il proposé aucune ? null si des tâches étaient attendues. */
  sansTacheJuste: boolean | null;
  /** Tâches proposées portant une date, sur celles proposées. */
  datees: number;
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

async function structurer(
  compte: CompteEvaluation,
  cas: Cas,
  config: Config,
): Promise<Resultat> {
  const premier = cas.messages[0];
  const dernier = cas.messages[cas.messages.length - 1];
  const attendues = cas.verite.taches.length;
  const { system, prompt } = contexteStructuration({
    compte: { ...compte, sujetsOuverts: [] },
    domaine: cas.verite.domaine
      ? {
          nom: cas.verite.domaine,
          description:
            compte.domaines.find((d) => d.nom === cas.verite.domaine)
              ?.description ?? null,
          instructions: [],
          documents: [],
        }
      : null,
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
      taches: [],
      contacts: [],
      messages: cas.messages,
    },
    contact: null,
    precedents: [],
    instant: { maintenant: dernier.recuLe },
  });
  try {
    const { sortie, mesure } = await extract({
      sollicitation: "banc-essai" satisfies Sollicitation,
      schema: SortieStructuration,
      nomSchema: "structuration_du_sujet",
      system,
      prompt,
      reasoning: config.niveau,
      modele: config.modele,
    });
    const retenue = retenirProposition(sortie, {
      registre: compte.etiquettes,
      precedents: [],
      instructions: compte.instructionsGenerales.map((i) => i.titre),
      documents: [],
      domaineConnu: cas.verite.domaine !== null,
      domaineProposeExistant: null,
      contact: "auto",
    });
    const proposees = retenue.taches.length;
    return {
      cas: cas.id,
      retenue,
      erreur: null,
      mesure,
      attendues,
      proposees,
      sansTacheJuste: attendues === 0 ? proposees === 0 : null,
      datees: retenue.taches.filter((t) => t.date).length,
    };
  } catch (e) {
    return {
      cas: cas.id,
      retenue: null,
      erreur: e instanceof Error ? e.message.slice(0, 200) : String(e),
      mesure: null,
      attendues,
      proposees: 0,
      sansTacheJuste: null,
      datees: 0,
    };
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)} % (${n}/${d})`;
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
  let cas = readFileSync(resolve(dossier, "cas.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cas)
    .filter((c) => c.verite.action === "a_traiter" && !c.verite.rattache);
  if (limite > 0) cas = cas.slice(0, limite);

  const informatifs = cas.filter((c) => c.verite.taches.length === 0).length;
  console.log(
    `Jeu « ${jeu} » : ${cas.length} sujets à structurer, dont ${informatifs} sans tâche attendue.\n`,
  );

  const rapport: Record<string, Resultat[]> = {};
  for (const config of configs) {
    const cle = `${config.modele}:${config.niveau}`;
    const debut = Date.now();
    const resultats = await enParallele(cas, parallele, (c) =>
      structurer(compte, c, config),
    );
    rapport[cle] = resultats;
    const ok = resultats.filter((r) => r.mesure);
    const mesures = ok.map((r) => r.mesure!);
    const coutMoyen = moy(mesures.map((m) => m.cout.eur));
    const proposees = ok.reduce((a, r) => a + r.proposees, 0);
    const attendues = ok.reduce((a, r) => a + r.attendues, 0);
    const datees = ok.reduce((a, r) => a + r.datees, 0);
    const info = ok.filter((r) => r.sansTacheJuste !== null);
    const sansTache = info.filter((r) => r.sansTacheJuste).length;
    const zeroInattendu = ok.filter(
      (r) => r.attendues > 0 && r.proposees === 0,
    ).length;

    console.log(`=== ${cle} — ${((Date.now() - debut) / 1000).toFixed(0)} s`);
    console.log(`  erreurs               : ${resultats.length - ok.length}`);
    console.log(
      `  tâches proposées      : ${proposees} pour ${attendues} attendues (${(proposees / Math.max(1, ok.length)).toFixed(1)} par sujet)`,
    );
    console.log(
      `  sujets informatifs    : sans tâche ${pct(sansTache, info.length)}`,
    );
    console.log(`  sujets à tâches rendus sans tâche : ${zeroInattendu}`);
    console.log(`  tâches datées         : ${pct(datees, proposees)}`);
    console.log(
      `  écarts (retenue)      : ${ok.reduce((a, r) => a + r.retenue!.ecarts.length, 0)}`,
    );
    console.log(
      `  longueurs moy. (car.) : résumé ${Math.round(moy(ok.map((r) => r.retenue!.resume?.length ?? 0)))} · où on en est ${Math.round(moy(ok.map((r) => r.retenue!.situation.ouOnEnEst?.length ?? 0)))} · prochaine étape ${Math.round(moy(ok.map((r) => r.retenue!.situation.prochaineEtape?.length ?? 0)))} · message ${Math.round(moy(cas.map((c) => c.messages.reduce((a, m) => a + m.contenu.length, 0))))}`,
    );
    console.log(
      `  coût moyen            : ${coutMoyen.toFixed(5)} € → ${(coutMoyen * 1000).toFixed(2)} € / 1 000 sujets`,
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
      const t = r.retenue?.taches ?? [];
      console.log(
        `  · ${r.cas} — attendues ${r.attendues}, proposées ${r.proposees}${r.erreur ? ` — ERREUR ${r.erreur}` : ""}`,
      );
      if (r.retenue) {
        console.log(`      résumé : ${r.retenue.resume ?? "—"}`);
        console.log(
          `      étape  : ${r.retenue.situation.prochaineEtape ?? "—"}${r.retenue.situation.echeance ? ` (${r.retenue.situation.echeance})` : ""}`,
        );
      }
      for (const x of t) {
        console.log(
          `      - [${x.type}] ${x.titre}${x.date ? ` (${x.date}${x.heure ? ` ${x.heure}` : ""})` : ""} — ${x.raison}`,
        );
        // Les décisions de la tâche (05 §3.1) : ce que le formulaire posera.
        for (const d of x.decisions) {
          console.log(
            `          ? ${d.question}${d.precision ? ` (${d.precision})` : ""} → ${d.options.join(" / ")}`,
          );
        }
      }
    }
    console.log();
  }

  const sortie = arg("sortie", "");
  if (sortie) {
    writeFileSync(sortie, JSON.stringify(rapport, null, 2));
    console.log(`Rapport écrit : ${sortie}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
