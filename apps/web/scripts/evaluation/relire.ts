// LANCEUR du jeu d'évaluation (M7.17) — la RELECTURE, hors application.
//
// Pour chaque SUITE du jeu (`suites.jsonl` : un message qui arrive sur un cas
// déjà suivi, avec ce qu'on en attend), rejoue d'abord la structuration du
// cas — le sujet tel que Relvo l'a laissé, situation et tâches —, puis la
// relecture avec le message nouveau, et mesure : accord sur « terminé », sur
// « en attente », sur la priorité, sur le nombre de tâches ajoutées ; ce
// que la retenue en fait (clôture suggérée ou non) ; coût, latence, cache,
// raisonnement de la relecture seule.
//
// La question de la tranche 6 : Relvo sait-il NE RIEN AJOUTER quand le
// message ne demande rien, et NE PAS conclure à la fin quand une tâche reste ?
// Le jeu porte pour cela des suites informatives, des suites qui closent et
// des suites qui rouvrent (`rouvert`).
//
// Usage :
//   node --env-file=.env.local --import tsx scripts/evaluation/relire.ts \
//     --jeu demo [--configs gpt-5.6-luna:low,gpt-5.6-luna:none] \
//     [--parallele 4] [--sortie /chemin/rapport.json] [--limite 5]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extract, type Sollicitation } from "../../src/server/ia/client";
import type { NiveauRaisonnement } from "../../src/server/ia/config";
import {
  contexteRelecture,
  contexteStructuration,
  type MessageContexte,
  type SujetContexte,
} from "../../src/server/ia/contexte";
import {
  retenirProposition,
  retenirRelecture,
  type RelectureRetenue,
} from "../../src/server/ia/pipeline/proposition";
import {
  SortieRelecture,
  SortieStructuration,
} from "../../src/server/ia/schemas";
import type { MesureSollicitation } from "../../src/server/ia/tarifs";
import { arg, enParallele, moy, pct } from "./commun";
import type { Cas, CompteEvaluation } from "./types";

type Config = { modele: string; niveau: NiveauRaisonnement };

/** Une suite : un message qui arrive sur un cas suivi, et ce qu'on en attend. */
type Suite = {
  id: string;
  cas: string;
  /** Le sujet était validé ; ce message l'a rouvert mécaniquement. */
  rouvert: boolean;
  message: MessageContexte;
  attendu: {
    termine: boolean;
    en_attente: boolean;
    /** null : la priorité n'est pas jugée sur cette suite. */
    priorite: "normal" | "urgent" | null;
    /** Tâches NOUVELLES attendues, exactement. */
    taches: number;
  };
};

type Resultat = {
  suite: string;
  retenue: RelectureRetenue | null;
  brut: { termine: boolean; en_attente: boolean; priorite: string } | null;
  erreur: string | null;
  mesure: MesureSollicitation | null;
  attendu: Suite["attendu"];
  /** Tâches ouvertes AVANT la relecture, héritées de la structuration. */
  tachesOuvertes: number;
};

function domaineDe(compte: CompteEvaluation, cas: Cas) {
  return cas.verite.domaine
    ? {
        nom: cas.verite.domaine,
        description:
          compte.domaines.find((d) => d.nom === cas.verite.domaine)
            ?.description ?? null,
        instructions: [],
        documents: [],
      }
    : null;
}

/** Le sujet tel que la structuration le laisse — rejouée comme dans `structurer.ts`. */
async function sujetStructure(
  compte: CompteEvaluation,
  cas: Cas,
  config: Config,
): Promise<SujetContexte> {
  const premier = cas.messages[0];
  const dernier = cas.messages[cas.messages.length - 1];
  const vide: SujetContexte = {
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
  };
  const { system, prompt } = contexteStructuration({
    compte: { ...compte, sujetsOuverts: [] },
    domaine: domaineDe(compte, cas),
    sujet: vide,
    contact: null,
    precedents: [],
    instant: { maintenant: dernier.recuLe },
  });
  const { sortie } = await extract({
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
  return {
    ...vide,
    etiquettes: retenue.etiquettes,
    situation: retenue.situation,
    resume: retenue.resume,
    taches: retenue.taches.map((t) => ({
      titre: t.titre,
      type: t.type,
      date: t.date,
      source: "relvo" as const,
      terminee: false,
    })),
  };
}

async function relire(
  compte: CompteEvaluation,
  cas: Cas,
  suite: Suite,
  config: Config,
): Promise<Resultat> {
  try {
    const sujet = await sujetStructure(compte, cas, config);
    const tachesOuvertes = sujet.taches.filter((t) => !t.terminee);
    const { system, prompt } = contexteRelecture({
      compte: { ...compte, sujetsOuverts: [] },
      domaine: domaineDe(compte, cas),
      sujet,
      precedents: [],
      nouveauxMessages: [suite.message],
      rouvert: suite.rouvert,
      instant: { maintenant: suite.message.recuLe },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "banc-essai" satisfies Sollicitation,
      schema: SortieRelecture,
      nomSchema: "relecture_du_sujet",
      system,
      prompt,
      reasoning: config.niveau,
      modele: config.modele,
    });
    const retenue = retenirRelecture(sortie, {
      registre: compte.etiquettes,
      precedents: [],
      instructions: compte.instructionsGenerales.map((i) => i.titre),
      documents: [],
      tachesOuvertes: tachesOuvertes.map((t) => t.titre),
      resolutionSuggeree: false,
    });
    return {
      suite: suite.id,
      retenue,
      brut: {
        termine: sortie.termine,
        en_attente: sortie.en_attente,
        priorite: sortie.priorite,
      },
      erreur: null,
      mesure,
      attendu: suite.attendu,
      tachesOuvertes: tachesOuvertes.length,
    };
  } catch (e) {
    return {
      suite: suite.id,
      retenue: null,
      brut: null,
      erreur: e instanceof Error ? e.message.slice(0, 200) : String(e),
      mesure: null,
      attendu: suite.attendu,
      tachesOuvertes: 0,
    };
  }
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
  const cas = new Map(
    readFileSync(resolve(dossier, "cas.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Cas)
      .map((c) => [c.id, c] as const),
  );
  let suites = readFileSync(resolve(dossier, "suites.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Suite);
  if (limite > 0) suites = suites.slice(0, limite);

  console.log(
    `Jeu « ${jeu} » : ${suites.length} suites à relire, dont ${suites.filter((s) => s.attendu.termine).length} qui closent, ${suites.filter((s) => s.attendu.en_attente).length} qui mettent en attente, ${suites.filter((s) => s.rouvert).length} qui rouvrent.\n`,
  );

  const rapport: Record<string, Resultat[]> = {};
  for (const config of configs) {
    const cle = `${config.modele}:${config.niveau}`;
    const debut = Date.now();
    const resultats = await enParallele(suites, parallele, (s) =>
      relire(compte, cas.get(s.cas)!, s, config),
    );
    rapport[cle] = resultats;
    const ok = resultats.filter((r) => r.mesure);
    const mesures = ok.map((r) => r.mesure!);
    const coutMoyen = moy(mesures.map((m) => m.cout.eur));
    const termine = ok.filter(
      (r) => r.brut!.termine === r.attendu.termine,
    ).length;
    const attente = ok.filter(
      (r) => r.brut!.en_attente === r.attendu.en_attente,
    ).length;
    const juges = ok.filter((r) => r.attendu.priorite !== null);
    const priorite = juges.filter(
      (r) => r.brut!.priorite === r.attendu.priorite,
    ).length;
    const taches = ok.filter(
      (r) => r.retenue!.taches.length === r.attendu.taches,
    ).length;
    const suggerees = ok.filter(
      (r) => r.retenue!.resolution === "suggerer",
    ).length;
    const suggereesATort = ok.filter(
      (r) => r.retenue!.resolution === "suggerer" && !r.attendu.termine,
    ).length;

    console.log(`=== ${cle} — ${((Date.now() - debut) / 1000).toFixed(0)} s`);
    console.log(`  erreurs                : ${resultats.length - ok.length}`);
    console.log(`  « terminé » juste      : ${pct(termine, ok.length)}`);
    console.log(`  « en attente » juste   : ${pct(attente, ok.length)}`);
    console.log(`  priorité juste         : ${pct(priorite, juges.length)}`);
    console.log(`  tâches ajoutées justes : ${pct(taches, ok.length)}`);
    console.log(
      `  clôtures suggérées     : ${suggerees} (dont à tort : ${suggereesATort}) — la retenue n'en suggère aucune tant qu'une tâche reste ouverte`,
    );
    console.log(
      `  écarts (retenue)       : ${ok.reduce((a, r) => a + r.retenue!.ecarts.length, 0)}`,
    );
    console.log(
      `  coût moyen (relecture) : ${coutMoyen.toFixed(5)} € → ${(coutMoyen * 1000).toFixed(2)} € / 1 000 relectures`,
    );
    console.log(
      `  latence moyenne        : ${(moy(mesures.map((m) => m.dureeMs)) / 1000).toFixed(1)} s`,
    );
    console.log(
      `  jetons entrée (dont relus en cache) : ${Math.round(moy(mesures.map((m) => m.jetons.entree + m.jetons.cacheLecture + m.jetons.cacheEcriture)))} (${Math.round(moy(mesures.map((m) => m.jetons.cacheLecture)))})`,
    );
    console.log(
      `  jetons sortie (raison.) : ${Math.round(moy(mesures.map((m) => m.jetons.sortie)))} (${Math.round(moy(mesures.map((m) => m.jetons.raisonnement)))})`,
    );
    for (const r of resultats) {
      console.log(
        `  · ${r.suite} — attendu terminé=${r.attendu.termine} attente=${r.attendu.en_attente} tâches=${r.attendu.taches}${r.erreur ? ` — ERREUR ${r.erreur}` : ""}`,
      );
      if (r.retenue && r.brut) {
        console.log(
          `      rendu  : terminé=${r.brut.termine} attente=${r.brut.en_attente} priorité=${r.brut.priorite} → ${r.retenue.resolution}${r.retenue.enAttente ? " · en attente posé" : ""} (${r.tachesOuvertes} tâche(s) déjà ouverte(s))`,
        );
        console.log(`      raison : ${r.retenue.raison ?? "—"}`);
        console.log(
          `      où on en est : ${r.retenue.situation.ouOnEnEst ?? "—"} · on attend : ${r.retenue.situation.attente ?? "—"}`,
        );
        for (const x of r.retenue.taches) {
          console.log(
            `      - [${x.type}] ${x.titre}${x.date ? ` (${x.date}${x.heure ? ` ${x.heure}` : ""})` : ""} — ${x.raison}`,
          );
        }
        for (const e of r.retenue.ecarts) console.log(`      ⚠ ${e}`);
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
