#!/usr/bin/env node
// Génère les données de la PAGE DE SUIVI CLIENT (M15.2).
//
// ⚠️ LECTURE AU BUILD, JAMAIS AU RUNTIME. Ce script tourne en `prebuild` et
// `predev` ; l'application ne consomme que le JSON qu'il écrit, importé
// STATIQUEMENT. Lire `backlog/` avec `fs` depuis une page lèverait ENOENT en
// PRODUCTION SEULEMENT : le traceur de Next analyse les `import`/`require`/`fs`
// statiquement et n'embarque pas un chemin construit à l'exécution. Ce dépôt a
// déjà payé exactement cette erreur sur les fixtures de démonstration — le
// commentaire de `apps/web/next.config.ts` la documente.
//
// ⚠️ LISTE BLANCHE. On lit le FRONTMATTER des épiques et le CHANGELOG, rien
// d'autre. Le CORPS d'un fichier d'épique n'est jamais ouvert : le parseur
// s'arrête au `---` de fermeture et n'émet que les champs nommés dans
// CHAMPS_PUBLIES. Une phrase écrite dans le corps ne peut donc pas fuir vers le
// client, même en la voulant. C'est une garantie MÉCANIQUE, pas disciplinaire —
// une liste noire de marqueurs échouerait le jour où l'on en oublie un.
//
// Spécification : backlog/suivi-client.md

import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_EPIQUES = join(RACINE, "backlog", "epics");
const CHANGELOG = join(RACINE, "CHANGELOG.md");
const SORTIE = join(RACINE, "apps", "web", "src", "generated", "suivi.json");

/** Les SEULS champs qui franchissent la frontière. Tout le reste est ignoré. */
const CHAMPS_PUBLIES = [
  "id",
  "public",
  "ordre_public",
  "titre_client",
  "resume_client",
  "statut",
  "debut",
  "fin",
];

/**
 * Extrait le bloc de frontmatter — et RIEN d'autre. La lecture s'arrête au
 * `---` de fermeture : le corps n'est jamais parcouru.
 */
function extraireFrontmatter(texte) {
  const lignes = texte.split(/\r?\n/);
  if (lignes[0]?.trim() !== "---") return null;
  const bloc = [];
  for (let i = 1; i < lignes.length; i++) {
    if (lignes[i].trim() === "---") return bloc;
    bloc.push(lignes[i]);
  }
  return null; // frontmatter non refermé
}

/** Convertit une valeur scalaire YAML minimale (booléen, entier, chaîne). */
function valeur(brut) {
  const v = brut.trim().replace(/^["'](.*)["']$/s, "$1");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

/**
 * Parseur YAML volontairement minimal : `cle: valeur` et scalaires repliés
 * (`cle: >` suivi de lignes indentées, jointes par une espace). Suffisant pour
 * le frontmatter spécifié, et assez pauvre pour ne pas exécuter de surprises.
 */
function parserFrontmatter(lignes) {
  const objet = {};
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const [, cle, reste] = m;
    if (reste === ">" || reste === "|" || reste === ">-" || reste === "|-") {
      const morceaux = [];
      while (i + 1 < lignes.length && /^\s+\S/.test(lignes[i + 1])) {
        morceaux.push(lignes[++i].trim());
      }
      objet[cle] = morceaux.join(" ");
    } else {
      objet[cle] = valeur(reste);
    }
  }
  return objet;
}

/** Ne garde que les champs de la liste blanche. */
function filtrer(objet) {
  const sortie = {};
  for (const cle of CHAMPS_PUBLIES) {
    if (objet[cle] !== undefined) sortie[cle] = objet[cle];
  }
  return sortie;
}

function lireEpiques() {
  const fichiers = readdirSync(DOSSIER_EPIQUES)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const epiques = [];
  for (const fichier of fichiers) {
    const bloc = extraireFrontmatter(
      readFileSync(join(DOSSIER_EPIQUES, fichier), "utf8"),
    );
    if (!bloc) {
      throw new Error(
        `[suivi] ${fichier} n'a pas de frontmatter refermé — impossible de savoir ce qui est publiable.`,
      );
    }
    epiques.push({ fichier, ...filtrer(parserFrontmatter(bloc)) });
  }
  return epiques;
}

// ---------------------------------------------------------------- journal

const ETIQUETTES = { Nouveau: "new", Corrigé: "fix" };

/**
 * Lit le CHANGELOG généré (cf. scripts/generate-changelog.mjs).
 * Format attendu :
 *   ## 2026-09-07
 *   - **Nouveau** — phrase
 * Absent = journal vide : la page reste juste, elle n'invente rien.
 */
function lireJournal() {
  if (!existsSync(CHANGELOG)) return [];
  const jours = [];
  let courant = null;
  for (const ligne of readFileSync(CHANGELOG, "utf8").split(/\r?\n/)) {
    const jour = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(ligne);
    if (jour) {
      courant = { date: jour[1], entrees: [] };
      jours.push(courant);
      continue;
    }
    const entree = /^-\s+\*\*(Nouveau|Corrigé)\*\*\s+—\s+(.+?)\s*$/.exec(ligne);
    if (entree && courant) {
      courant.entrees.push({
        type: ETIQUETTES[entree[1]],
        texte: entree[2],
      });
    }
  }
  return jours.filter((j) => j.entrees.length > 0);
}

// ---------------------------------------------------------------- frise

const MOIS = [
  "jan",
  "fév",
  "mar",
  "avr",
  "mai",
  "jun",
  "jul",
  "aoû",
  "sep",
  "oct",
  "nov",
  "déc",
];

const jour = (iso) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Bornes de l'axe : du 1er du mois de la plus ancienne date au 1er du mois
 * SUIVANT la plus récente. Les mois creux restent donc visibles — on ne
 * comprime pas le temps pour flatter la frise.
 */
function construireAxe(epiques) {
  const dates = [];
  for (const e of epiques) {
    if (e.debut) dates.push(e.debut);
    if (e.fin) dates.push(e.fin);
  }
  if (dates.length === 0) return null;
  dates.sort();
  const [ay, am] = dates[0].split("-").map(Number);
  const [zy, zm] = dates[dates.length - 1].split("-").map(Number);
  const debut = Date.UTC(ay, am - 1, 1);
  const fin = Date.UTC(zm === 12 ? zy + 1 : zy, zm === 12 ? 0 : zm, 1);
  const libelles = [];
  for (
    let d = new Date(debut);
    d.getTime() < fin;
    d.setUTCMonth(d.getUTCMonth() + 1)
  ) {
    libelles.push({ mois: MOIS[d.getUTCMonth()], annee: d.getUTCFullYear() });
  }
  return {
    debut: new Date(debut).toISOString().slice(0, 10),
    fin: new Date(fin).toISOString().slice(0, 10),
    libelles,
  };
}

function main() {
  const toutes = lireEpiques();
  const publiques = toutes
    .filter((e) => e.public === true)
    .sort((a, b) => (a.ordre_public ?? 0) - (b.ordre_public ?? 0));

  const axe = construireAxe(publiques);
  if (!axe)
    throw new Error(
      "[suivi] aucune épique publique datée : la frise serait vide.",
    );

  const total = jour(axe.fin) - jour(axe.debut);
  const pct = (iso) => ((jour(iso) - jour(axe.debut)) / total) * 100;
  const arrondi = (n) => Math.round(n * 100) / 100;

  const chantiers = publiques.map((e) => {
    const gauche = arrondi(pct(e.debut));
    // Un chantier sans fin (en cours, sans échéance annoncée) court jusqu'à sa
    // date de début : une barre de largeur nulle serait invisible, on pose le
    // minimum lisible côté CSS (min-width), pas ici — on ne ment pas sur la durée.
    const largeur = arrondi(e.fin ? pct(e.fin) - gauche : 0);
    return {
      titre: e.titre_client,
      resume: e.resume_client,
      statut: e.statut,
      gauche,
      largeur,
    };
  });

  // Jalon de livraison = la date de fin la plus lointaine des chantiers publics.
  // Dérivé, jamais saisi : il ne peut donc pas contredire la frise.
  const fins = publiques
    .map((e) => e.fin)
    .filter(Boolean)
    .sort();
  const livraison = fins.length > 0 ? fins[fins.length - 1] : null;

  const enCours = publiques.find((e) => e.statut === "en-cours") ?? null;

  const donnees = {
    // Champ de garde : si ce fichier venait à être lu par autre chose, il dit
    // d'où il vient et qu'il ne se modifie pas à la main.
    genere_par: "scripts/generate-suivi.mjs",
    axe,
    chantiers,
    livraison: livraison
      ? { date: livraison, gauche: arrondi(pct(livraison)) }
      : null,
    en_cours: enCours ? enCours.titre_client : null,
    journal: lireJournal(),
  };

  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, `${JSON.stringify(donnees, null, 2)}\n`, "utf8");

  const nbEntrees = donnees.journal.reduce((n, j) => n + j.entrees.length, 0);
  console.log(
    `[suivi] ${chantiers.length} chantier(s) publiés sur ${toutes.length} épique(s) · ${donnees.journal.length} jour(s) de journal, ${nbEntrees} entrée(s) → ${SORTIE.replace(RACINE + "/", "")}`,
  );
}

main();
