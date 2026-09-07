#!/usr/bin/env node
// Génère CHANGELOG.md depuis les commits (M15.7).
//
// ⚠️ CE SCRIPT NE TOURNE PAS AU BUILD. Le fichier qu'il produit est COMMITÉ, et
// c'est un compromis assumé : la plateforme de déploiement clone en profondeur
// limitée, donc `git log` n'est pas fiable au moment du build. Un fichier dérivé
// versionné se paie en diffs, mais c'est la seule source stable en production.
// On le régénère à la main : `pnpm changelog`.
//
// LE FILTRE EST LA CONVENTION DE COMMITS ELLE-MÊME. Seuls `feat` et `fix`
// franchissent la frontière ; `docs`, `chore`, `refactor`, `perf`, `style`,
// `test`, `ci` n'ont rien à dire à un dirigeant et ne sont même pas regardés.
//
// LE PIED DE MESSAGE `Client:` — un sujet de commit est écrit pour l'équipe, et
// seul un tiers environ se lit tel quel par un client.
//   `Client: <phrase>`  → c'est cette phrase qui est publiée
//   absent              → le sujet du commit est publié tel quel
//   `Client: -`         → l'entrée n'est PAS publiée
//
// Spécification : backlog/suivi-client.md

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "CHANGELOG.md");

const SEP_CHAMP = "\x1f";
const SEP_COMMIT = "\x1e";

/** `feat(scope)!: sujet` → { type, sujet }. Tout le reste renvoie null. */
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

const ETIQUETTE = { feat: "Nouveau", fix: "Corrigé" };

function main() {
  const jours = new Map();
  let ecartes = 0;
  let reformules = 0;

  for (const commit of lireCommits()) {
    const entete = analyserSujet(commit.sujet);
    if (!entete) continue; // ni feat ni fix : la frontière ne bouge pas

    const client = extraireClient(commit.corps);
    if (client === "-") {
      ecartes++;
      continue;
    }
    if (client) reformules++;

    if (!jours.has(commit.date)) jours.set(commit.date, []);
    jours.get(commit.date).push({
      etiquette: ETIQUETTE[entete.type],
      texte: client ?? entete.sujet,
    });
  }

  const dates = [...jours.keys()].sort().reverse();
  const lignes = [
    "# Journal des versions",
    "",
    "<!-- Généré par scripts/generate-changelog.mjs (`pnpm changelog`).",
    "     Ne pas éditer à la main : toute correction se fait dans le pied",
    "     de message `Client:` du commit concerné, puis on régénère. -->",
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

  const total = [...jours.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `[changelog] ${total} entrée(s) sur ${dates.length} jour(s) · ${reformules} reformulée(s) par un pied « Client: » · ${ecartes} écartée(s) par « Client: - » → CHANGELOG.md`,
  );
}

main();
