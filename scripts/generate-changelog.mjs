#!/usr/bin/env node
// Génère CHANGELOG.md — le journal des versions de la page de suivi (M15.7).
//
// ⚠️ CE SCRIPT NE TOURNE PAS AU BUILD. Le fichier qu'il produit est COMMITÉ, et
// c'est un compromis assumé : la plateforme de déploiement clone en profondeur
// limitée, donc `git log` n'est pas fiable au moment du build. Un fichier dérivé
// versionné se paie en diffs, mais c'est la seule source stable en production.
// On le régénère à la main : `pnpm changelog`.
//
// ══════════════════════════════════════════════════════════════════════════
// LE PIED `Client:` EST OBLIGATOIRE — REFUS PAR DÉFAUT.
// ══════════════════════════════════════════════════════════════════════════
//   `Client: <phrase>`  → publiée
//   `Client: -`         → écartée explicitement
//   ABSENT              → ÉCARTÉE AUSSI, et c'est le point.
//
// La règle précédente publiait le sujet du commit à défaut de pied. Elle
// paraissait généreuse ; elle a produit un journal de 143 lignes écrites pour
// l'équipe — « pièges #5b ET #5c », « migration name → first_name/last_name ».
// Un journal illisible est PIRE qu'un journal absent : il est lu, il n'apprend
// rien, et il occupe la place de celui qui aurait servi.
//
// Un repli silencieux qui publie du jargon chez le client est un défaut qui
// s'ouvre tout seul. Le refus par défaut, lui, se voit : l'entrée manque.
//
// LE FILTRE DE TYPE RESTE : seuls `feat` et `fix` sont même regardés. `docs`,
// `chore`, `refactor`, `perf`, `style`, `test`, `ci` n'ont rien à dire.
//
// LA REPRISE — les commits antérieurs à REPRISE ne sont pas lus du tout : leur
// période est couverte, une fois pour toutes, par backlog/journal-client.md.
//
// Spécification : backlog/suivi-client.md

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "CHANGELOG.md");
const REPRISE_FICHIER = join(RACINE, "backlog/journal-client.md");

/**
 * La frontière entre les deux régimes du journal.
 * AVANT  → le fichier de reprise, écrit à la main et figé.
 * DEPUIS → les commits, et eux seuls.
 * Aucune date ne peut appartenir aux deux : c'est vérifié plus bas.
 */
const REPRISE = "2026-09-08";

const SEP_CHAMP = "\x1f";
const SEP_COMMIT = "\x1e";
const ETIQUETTE = { feat: "Nouveau", fix: "Corrigé" };

function echouer(message) {
  console.error(`\n✖ [changelog] ${message}\n`);
  process.exit(1);
}

/** `feat(scope)!: sujet` → { type }. Tout le reste renvoie null. */
function analyserSujet(sujet) {
  const m = /^(feat|fix)(?:\([^)]*\))?!?:\s*(.+)$/.exec(sujet);
  return m ? { type: m[1], sujet: m[2].trim() } : null;
}

/**
 * Extrait le pied `Client:` — éventuellement sur plusieurs lignes, jusqu'à une
 * ligne vide ou un autre pied de message (`Co-Authored-By:`, `Refs:`…).
 * Renvoie `null` si absent, `"-"` si l'entrée est explicitement écartée.
 */
function extraireClient(corps) {
  const lignes = corps.split(/\r?\n/);
  const i = lignes.findIndex((l) => /^Client:\s*/i.test(l));
  if (i === -1) return null;
  const morceaux = [lignes[i].replace(/^Client:\s*/i, "").trim()];
  for (let j = i + 1; j < lignes.length; j++) {
    const l = lignes[j];
    if (!l.trim()) break;
    if (/^[A-Za-z-]+:\s/.test(l)) break; // autre pied de message
    morceaux.push(l.trim());
  }
  const phrase = morceaux.join(" ").trim();
  return phrase === "-" ? "-" : phrase;
}

function lireCommits() {
  const brut = execFileSync(
    "git",
    [
      "log",
      "--no-merges",
      `--since=${REPRISE}`,
      `--pretty=format:%ad${SEP_CHAMP}%s${SEP_CHAMP}%b${SEP_COMMIT}`,
      "--date=short",
    ],
    { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return brut
    .split(SEP_COMMIT)
    .map((bloc) => bloc.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((bloc) => {
      const [date, sujet, corps = ""] = bloc.split(SEP_CHAMP);
      return { date, sujet, corps };
    });
}

/**
 * Lit le journal de reprise : les entrées antérieures à la convention, écrites
 * à la main en langage client.
 *
 * ⚠️ CE FICHIER EST FIGÉ, et la garantie est mécanique. Une date qui atteint
 * REPRISE fait échouer la génération. Sans cette borne, le fichier redeviendrait
 * mois après mois la vraie façon d'écrire le journal — et la discipline du pied
 * `Client:`, qu'aucune machine ne peut rattraper ensuite, serait contournée
 * sans que personne n'ait décidé de la contourner.
 */
function lireReprise() {
  if (!existsSync(REPRISE_FICHIER)) return new Map();

  const jours = new Map();
  let date = null;
  for (const ligne of readFileSync(REPRISE_FICHIER, "utf8").split(/\r?\n/)) {
    const titre = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(ligne);
    if (titre) {
      date = titre[1];
      if (date >= REPRISE) {
        echouer(
          `backlog/journal-client.md contient la date ${date}, qui atteint la reprise (${REPRISE}).\n` +
            `  Ce fichier ne couvre QUE la période antérieure. Depuis la reprise, une entrée\n` +
            `  du journal s'écrit dans le pied « Client: » du commit concerné.`,
        );
      }
      continue;
    }
    const entree = /^-\s+\*\*(Nouveau|Corrigé)\*\*\s+—\s+(.+?)\s*$/.exec(ligne);
    if (!entree || !date) continue;
    if (!jours.has(date)) jours.set(date, []);
    jours.get(date).push({ etiquette: entree[1], texte: entree[2] });
  }
  return jours;
}

function main() {
  const jours = lireReprise();
  const reprises = [...jours.values()].reduce((n, l) => n + l.length, 0);
  let ecartes = 0;
  let muets = 0;
  let publies = 0;

  for (const commit of lireCommits()) {
    const entete = analyserSujet(commit.sujet);
    if (!entete) continue; // ni feat ni fix : la frontière ne bouge pas

    const client = extraireClient(commit.corps);
    if (client === "-") {
      ecartes++;
      continue;
    }
    if (client === null) {
      // REFUS PAR DÉFAUT. On le signale : un commit `feat`/`fix` sans pied est
      // presque toujours un oubli, pas une intention.
      muets++;
      console.warn(
        `  ⚠ sans pied « Client: » — ${commit.date} ${commit.sujet}`,
      );
      continue;
    }

    if (!jours.has(commit.date)) jours.set(commit.date, []);
    jours.get(commit.date).push({
      etiquette: ETIQUETTE[entete.type],
      texte: client,
    });
    publies++;
  }

  const dates = [...jours.keys()].sort().reverse();
  const lignes = [
    "# Journal des versions",
    "",
    "<!-- Généré par scripts/generate-changelog.mjs (`pnpm changelog`).",
    "     Ne pas éditer à la main. Depuis la reprise, une entrée s'écrit dans le",
    "     pied « Client: » du commit ; avant elle, dans backlog/journal-client.md. -->",
    "",
  ];
  for (const date of dates) {
    lignes.push(`## ${date}`, "");
    for (const e of jours.get(date)) {
      lignes.push(`- **${e.etiquette}** — ${e.texte}`);
    }
    lignes.push("");
  }

  writeFileSync(SORTIE, `${lignes.join("\n").trimEnd()}\n`, "utf8");

  console.log(
    `[changelog] ${reprises + publies} entrée(s) sur ${dates.length} jour(s) → CHANGELOG.md\n` +
      `            ${reprises} de reprise · ${publies} depuis un pied « Client: » · ` +
      `${ecartes} écartée(s) par « Client: - » · ${muets} sans pied (NON publiée(s))`,
  );
}

main();
