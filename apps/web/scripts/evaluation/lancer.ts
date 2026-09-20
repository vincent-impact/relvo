// LANCEUR du jeu d'évaluation (M7.17, tranche 1) — le TRI, hors application.
//
// Pour chaque configuration (modèle × niveau de raisonnement), rend l'avis de
// tri sur chaque cas et mesure : accord avec le tri manuel (action, nature,
// rattachement, domaine), coût en euros, latence, jetons de raisonnement,
// jetons lus en cache. C'est la première question du sprint : combien coûte un message
// traité, à quelle latence — et le tier de l'extraction se tranche dessus.
//
// Usage :
//   node --env-file=.env.local --import tsx scripts/evaluation/lancer.ts \
//     --jeu demo [--configs gpt-5.6-luna:none,gpt-5.6-luna:low,gpt-5.6-terra:low] \
//     [--parallele 4] [--sortie /chemin/rapport.json] [--limite 5] [--cache <cle>] [--flex]
//
// `--flex` passe les appels EN LOT (niveau de service « flex » du fournisseur,
// tranche 9) : le prix du rattrapage nocturne, et sa latence.
//
// `--cache <cle>` adresse le cache du fournisseur comme en production — une
// clé par compte, la rétention de la configuration — et le rapport confronte
// les jetons relus au préfixe stable poussé (tranche 8, M7.13). Sans clé, le
// fournisseur route au hasard : c'est la mesure d'avant.
//
// Les modèles nommés ici doivent avoir un tarif (`src/server/ia/tarifs.ts`).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extract, type Sollicitation } from "../../src/server/ia/client";
import type { NiveauRaisonnement } from "../../src/server/ia/config";
import { contexteTri, prefixeStable } from "../../src/server/ia/contexte";
import { SortieTri } from "../../src/server/ia/schemas";
import type { MesureSollicitation } from "../../src/server/ia/tarifs";
import type { Cas, CompteEvaluation } from "./types";

function arg(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? (process.argv[i + 1] ?? defaut) : defaut;
}

type Config = {
  modele: string;
  niveau: NiveauRaisonnement;
  cache?: string;
  lot?: boolean;
};
type Resultat = {
  cas: string;
  sortie: SortieTri | null;
  erreur: string | null;
  mesure: MesureSollicitation | null;
  /** null quand le modèle rend « a_considerer » : ni juste ni faux. */
  accordAction: boolean | null;
  accordNature: boolean | null;
  /** Le fil devait rejoindre un sujet ouvert — l'a-t-il fait ? null si rien n'était attendu. */
  accordRattachement: boolean | null;
  accordDomaine: boolean | null;
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

async function trier(
  compte: CompteEvaluation,
  cas: Cas,
  config: Config,
): Promise<Resultat> {
  const dernier = cas.messages[cas.messages.length - 1];
  const contexte = contexteTri({
    // Le sujet né de ce fil n'existait pas au moment du tri : on ne le montre pas.
    compte: {
      ...compte,
      sujetsOuverts: compte.sujetsOuverts.filter(
        (s) => s.reference !== cas.verite.reference,
      ),
    },
    conversation: { canal: cas.canal, messages: cas.messages },
    // La date du jour est celle du dernier message : « avant jeudi » se lit par rapport à elle.
    instant: { maintenant: dernier.recuLe },
  });
  try {
    const { sortie, mesure } = await extract({
      sollicitation: "banc-essai" satisfies Sollicitation,
      schema: SortieTri,
      nomSchema: "verdict_de_tri",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: config.niveau,
      modele: config.modele,
      cacheCle: config.cache,
      prefixeStable: prefixeStable(contexte),
      lot: config.lot,
    });
    // « a_considerer » n'est ni juste ni faux : c'est un renvoi au dirigeant.
    // On le compte à part, jamais comme un accord.
    const accordAction =
      sortie.action === "a_considerer"
        ? null
        : sortie.action === cas.verite.action;
    const accordNature = sortie.nature === cas.verite.nature;
    const accordRattachement = cas.verite.rattache
      ? (sortie.sujet_existant ?? "").trim() === cas.verite.rattache
      : null;
    const accordDomaine =
      cas.verite.action === "a_traiter" && sortie.action === "a_traiter"
        ? (sortie.domaine ?? null) === cas.verite.domaine
        : null;
    return {
      cas: cas.id,
      sortie,
      erreur: null,
      mesure,
      accordAction,
      accordNature,
      accordRattachement,
      accordDomaine,
    };
  } catch (e) {
    return {
      cas: cas.id,
      sortie: null,
      erreur: e instanceof Error ? e.message.slice(0, 200) : String(e),
      mesure: null,
      accordAction: null,
      accordNature: null,
      accordRattachement: null,
      accordDomaine: null,
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
  const cache = arg("cache", "") || undefined;
  const lot = process.argv.includes("--flex");
  const configs: Config[] = arg("configs", "gpt-5.6-luna:none,gpt-5.6-luna:low")
    .split(",")
    .map((c) => {
      const [modele, niveau] = c.split(":");
      return { modele, niveau: niveau as NiveauRaisonnement, cache, lot };
    });
  const dossier = resolve(import.meta.dirname, "jeu", jeu);
  const compte = JSON.parse(
    readFileSync(resolve(dossier, "compte.json"), "utf8"),
  ) as CompteEvaluation;
  let cas = readFileSync(resolve(dossier, "cas.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cas);
  if (limite > 0) cas = cas.slice(0, limite);

  const rapport: Record<
    string,
    { resultats: Resultat[]; synthese: Record<string, string> }
  > = {};
  console.log(
    `Jeu « ${jeu} » : ${cas.length} cas · ${configs.length} configuration(s)\n`,
  );

  for (const config of configs) {
    const nom = `${config.modele}:${config.niveau}${config.lot ? " · flex" : ""}`;
    const t0 = Date.now();
    const resultats = await enParallele(cas, parallele, (c) =>
      trier(compte, c, config),
    );
    const ok = resultats.filter((r) => r.mesure);
    const jugés = resultats.filter((r) => r.accordAction !== null);
    const natures = resultats.filter((r) => r.accordNature !== null);
    const rattachements = resultats.filter(
      (r) => r.accordRattachement !== null,
    );
    const affaires = resultats.filter((r) => r.accordDomaine !== null);
    const aConsiderer = resultats.filter(
      (r) => r.sortie?.action === "a_considerer",
    ).length;
    // Un rattachement que la vérité n'attendait pas : le fil aurait rejoint un
    // sujet qui n'était pas la même affaire — à surveiller autant que l'inverse.
    const rattachementsIndus = resultats.filter((r) => {
      const c = cas.find((x) => x.id === r.cas)!;
      return !c.verite.rattache && (r.sortie?.sujet_existant ?? "").trim();
    }).length;
    const synthese = {
      "actions justes": pct(
        jugés.filter((r) => r.accordAction).length,
        jugés.length,
      ),
      "natures justes": pct(
        natures.filter((r) => r.accordNature).length,
        natures.length,
      ),
      "rattachements justes (sur fils qui prolongent un sujet)": pct(
        rattachements.filter((r) => r.accordRattachement).length,
        rattachements.length,
      ),
      "rattachements non attendus": `${rattachementsIndus}`,
      "à considérer": `${aConsiderer}`,
      "domaines justes (sur affaires reconnues)": pct(
        affaires.filter((r) => r.accordDomaine).length,
        affaires.length,
      ),
      erreurs: `${resultats.length - ok.length}`,
      "coût total": `${ok.reduce((s, r) => s + r.mesure!.cout.eur, 0).toFixed(5)} €`,
      "coût / message": `${(moy(ok.map((r) => r.mesure!.cout.eur)) * 1000).toFixed(3)} €/1000`,
      "latence moyenne": `${Math.round(moy(ok.map((r) => r.mesure!.dureeMs)))} ms`,
      "jetons entrée moy.": `${Math.round(moy(ok.map((r) => r.mesure!.jetons.entree + r.mesure!.jetons.cacheLecture + r.mesure!.jetons.cacheEcriture)))}`,
      "dont lus en cache moy.": `${Math.round(moy(ok.map((r) => r.mesure!.jetons.cacheLecture)))}`,
      "préfixe stable moy. (attendu en cache)": `${Math.round(moy(ok.map((r) => r.mesure!.prefixeStable ?? 0)))}${cache ? ` · clé « ${cache} »` : " · sans clé"}`,
      "jetons sortie moy.": `${Math.round(moy(ok.map((r) => r.mesure!.jetons.sortie)))}`,
      "dont raisonnement moy.": `${Math.round(moy(ok.map((r) => r.mesure!.jetons.raisonnement)))}`,
      "durée du lot": `${Math.round((Date.now() - t0) / 1000)} s`,
    };
    rapport[nom] = { resultats, synthese };

    console.log(`## ${nom}`);
    for (const [k, v] of Object.entries(synthese)) console.log(`- ${k} : ${v}`);
    console.log(
      `\n| cas | vérité | avis | conf. | sujet (vérité) | domaine (vérité) | titre proposé | raison |`,
    );
    console.log(`|---|---|---|---|---|---|---|---|`);
    for (const r of resultats) {
      const c = cas.find((x) => x.id === r.cas)!;
      if (!r.sortie) {
        console.log(
          `| ${r.cas} | ${c.verite.action} · ${c.verite.nature} | ERREUR | | | | | ${r.erreur} |`,
        );
        continue;
      }
      const marque =
        r.accordAction === false ? " ❌" : r.accordAction === null ? " ❔" : "";
      const nat = r.accordNature === false ? " ❌" : "";
      const rat = r.accordRattachement === false ? " ❌" : "";
      const dom = r.accordDomaine === false ? " ❌" : "";
      console.log(
        `| ${r.cas} | ${c.verite.action} · ${c.verite.nature} | ${r.sortie.action}${marque} · ${r.sortie.nature}${nat} | ${r.sortie.confiance} | ${r.sortie.sujet_existant ?? "∅"}${rat} (${c.verite.rattache ?? "∅"}) | ${r.sortie.domaine ?? "∅"}${dom} (${c.verite.domaine ?? "∅"}) | ${r.sortie.titre ?? ""} | ${r.sortie.raison} |`,
      );
    }
    console.log("");
  }

  const sortie = arg("sortie", "");
  if (sortie) {
    writeFileSync(
      sortie,
      JSON.stringify({ jeu, date: new Date().toISOString(), rapport }, null, 2),
    );
    console.log(`Rapport écrit : ${sortie}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
