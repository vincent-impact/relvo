// LE BENCHMARK DE LA DICTÉE (M22.1) — dix dictées en français, enregistrées
// depuis l'iPhone en PWA installée (page d'essai du backoffice, partagées
// vers le Mac), transcrites par chaque modèle candidat AVEC et SANS le
// vocabulaire du compte. Ce qui tranche : les NOMS du compte écrits juste ;
// ensuite le taux d'erreur mot, la latence, le coût à la minute. Le rapport
// s'écrit dans `backlog/benchmark-iag.md` §6.12 — sans un mot des dictées
// elles-mêmes : ce sont des données personnelles, elles vivent HORS dépôt.
//
// Usage :
//   pnpm --filter web eval:dictee --dossier ~/Relvo/dictees \
//     [--compte demo@tastycrousty.fr] [--modeles gpt-4o-mini-transcribe,gpt-transcribe,gpt-4o-transcribe] \
//     [--sortie /chemin/rapport.json] [--parallele 2]
//
// Le dossier porte `cas.jsonl`, une ligne par dictée :
//   {"id":"D1","fichier":"dictee-1.m4a","texte":"<ce qui a été dit>","noms":["Karim Benali","ClimaPro"]}
// `texte` est la référence (tapée à la main après coup) ; `noms` les noms
// propres que la transcription doit écrire exactement (casse ignorée).
//
// Le vocabulaire vient du compte désigné (`--compte`), lu par le domaine
// comme en production ; sans compte, la variante « avec » est sautée.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictationVocabulary, prisma, tenantDb } from "@relvo/db";
import { transcrire } from "../../src/server/ia/client";
import { promptDictee } from "../../src/server/ia/dictee/vocabulaire";
import type { MesureSollicitation } from "../../src/server/ia/tarifs";
import { arg, enParallele, moy, pct } from "./commun";

type Cas = { id: string; fichier: string; texte: string; noms: string[] };

type Resultat = {
  cas: string;
  modele: string;
  vocabulaire: boolean;
  texte: string | null;
  erreur: string | null;
  mesure: MesureSollicitation | null;
  wer: number | null;
  nomsJustes: number;
  nomsAttendus: number;
};

/** Mots comparables : minuscules, sans ponctuation, espaces normalisés. */
export function mots(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Taux d'erreur mot : distance d'édition entre deux listes de mots, sur la référence. */
export function tauxErreurMot(reference: string, hypothese: string): number {
  const r = mots(reference);
  const h = mots(hypothese);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= h.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[h.length] / r.length;
}

/** Les noms propres écrits juste (casse et ponctuation ignorées). */
export function nomsEcritsJuste(noms: string[], hypothese: string): number {
  const h = ` ${mots(hypothese).join(" ")} `;
  return noms.filter((n) => h.includes(` ${mots(n).join(" ")} `)).length;
}

async function main() {
  const dossier = arg("dossier", "");
  if (!dossier) {
    console.error("--dossier <chemin> est obligatoire (hors dépôt).");
    process.exit(1);
  }
  const email = arg("compte", "");
  const modeles = arg(
    "modeles",
    "gpt-4o-mini-transcribe,gpt-transcribe,gpt-4o-transcribe",
  ).split(",");
  const parallele = Number(arg("parallele", "2"));
  const sortie = arg("sortie", "");

  const cas: Cas[] = readFileSync(resolve(dossier, "cas.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Cas);

  let prompt: string | null = null;
  if (email) {
    const compte = await prisma.account.findUnique({ where: { email } });
    if (!compte) {
      console.error(`Aucun compte « ${email} ».`);
      process.exit(1);
    }
    prompt = promptDictee(
      await getDictationVocabulary(tenantDb(compte.id), compte.id),
    );
    console.log(
      `Vocabulaire du compte (${prompt.length} caractères) :\n${prompt}\n`,
    );
  }

  const configs = modeles.flatMap((modele) =>
    prompt === null
      ? [{ modele, vocabulaire: false }]
      : [
          { modele, vocabulaire: false },
          { modele, vocabulaire: true },
        ],
  );

  const resultats = await enParallele(
    configs.flatMap((c) => cas.map((k) => ({ c, k }))),
    parallele,
    async ({ c, k }): Promise<Resultat> => {
      const chemin = resolve(dossier, k.fichier);
      const audio = new Uint8Array(readFileSync(chemin));
      try {
        const { sortie: texte, mesure } = await transcrire({
          sollicitation: "banc-essai",
          audio,
          // La durée réelle vient du fournisseur ; ici on ne la connaît pas encore.
          dureeS: 0,
          prompt: c.vocabulaire ? (prompt ?? undefined) : undefined,
          modele: c.modele,
        });
        return {
          cas: k.id,
          modele: c.modele,
          vocabulaire: c.vocabulaire,
          texte,
          erreur: null,
          mesure,
          wer: tauxErreurMot(k.texte, texte),
          nomsJustes: nomsEcritsJuste(k.noms, texte),
          nomsAttendus: k.noms.length,
        };
      } catch (err) {
        return {
          cas: k.id,
          modele: c.modele,
          vocabulaire: c.vocabulaire,
          texte: null,
          erreur: err instanceof Error ? err.message : String(err),
          mesure: null,
          wer: null,
          nomsJustes: 0,
          nomsAttendus: k.noms.length,
        };
      }
    },
  );

  console.log(
    "| modèle | vocabulaire | dictées | noms justes | WER moyen | latence moy. | audio | coût total | €/min |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const c of configs) {
    const rs = resultats.filter(
      (r) => r.modele === c.modele && r.vocabulaire === c.vocabulaire,
    );
    const ok = rs.filter((r) => r.texte !== null);
    const noms = rs.reduce((s, r) => s + r.nomsJustes, 0);
    const attendus = rs.reduce((s, r) => s + r.nomsAttendus, 0);
    const audioS = ok.reduce((s, r) => s + (r.mesure?.audioSecondes ?? 0), 0);
    const cout = ok.reduce((s, r) => s + (r.mesure?.cout.eur ?? 0), 0);
    console.log(
      `| ${c.modele} | ${c.vocabulaire ? "avec" : "sans"} | ${ok.length}/${rs.length} | ${pct(noms, attendus)} | ${(100 * moy(ok.map((r) => r.wer ?? 1))).toFixed(1)} % | ${Math.round(moy(ok.map((r) => r.mesure?.dureeMs ?? 0)))} ms | ${(audioS / 60).toFixed(2)} min | ${cout.toFixed(4)} € | ${audioS ? ((60 * cout) / audioS).toFixed(4) : "—"} € |`,
    );
  }
  const erreurs = resultats.filter((r) => r.erreur);
  if (erreurs.length) {
    console.log(`\nErreurs (${erreurs.length}) :`);
    for (const e of erreurs)
      console.log(`- ${e.cas} · ${e.modele} · ${e.erreur}`);
  }
  if (sortie) {
    writeFileSync(sortie, JSON.stringify(resultats, null, 2));
    console.log(`\nRapport détaillé : ${sortie}`);
  }
  await prisma.$disconnect();
}

if (process.argv[1] && /dicter\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
