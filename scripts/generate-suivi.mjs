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

// ---------------------------------------------------------------- validation

const STATUTS = ["a-faire", "en-cours", "termine", "partiel"];
const DATES = ["debut", "fin"];

/**
 * Les CINQ règles de cohérence de la spécification (M15.3).
 *
 * ⚠️ Elles font ÉCHOUER LE BUILD, elles n'avertissent pas. Une page de suivi
 * fausse est pire qu'une page absente : elle est lue, et elle est crue. Un
 * avertissement dans un log de build n'est lu par personne — c'est exactement
 * ainsi qu'une frise se met à mentir sans que quiconque s'en aperçoive.
 *
 * Même principe que le test qui tient les contraintes du modèle de données :
 * tenu par une mécanique, jamais par la vigilance.
 */
function valider(epiques) {
  const erreurs = [];
  const publiques = epiques.filter((e) => e.public === true);

  // 1. Au plus UNE épique publique en cours — sinon le client ne sait plus sur
  //    quoi on travaille, et la cellule « En cours » de l'en-tête devient un
  //    choix arbitraire entre deux vérités.
  const enCours = publiques.filter((e) => e.statut === "en-cours");
  if (enCours.length > 1) {
    erreurs.push(
      `${enCours.length} épiques publiques sont « en-cours » (${enCours.map((e) => e.id).join(", ")}) — il n'en faut qu'une.`,
    );
  }

  for (const e of epiques) {
    const ou = `${e.fichier} (${e.id ?? "sans id"})`;

    // 2. Une épique publiée dit ce qu'elle apporte, en langage client.
    if (e.public === true) {
      if (!e.titre_client)
        erreurs.push(`${ou} est publique mais n'a pas de titre_client.`);
      if (!e.resume_client)
        erreurs.push(`${ou} est publique mais n'a pas de resume_client.`);
    }

    // Garde de rendu (hors des cinq règles) : un statut inconnu ne produirait ni
    // pastille ni barre — la ligne existerait, vide, sans que rien ne le signale.
    if (e.statut && !STATUTS.includes(e.statut)) {
      erreurs.push(
        `${ou} porte le statut inconnu « ${e.statut} » (attendu : ${STATUTS.join(" | ")}).`,
      );
    }
    for (const cle of DATES) {
      if (e[cle] && !/^\d{4}-\d{2}-\d{2}$/.test(String(e[cle]))) {
        erreurs.push(
          `${ou} : ${cle} = « ${e[cle]} » n'est pas une date AAAA-MM-JJ.`,
        );
      }
    }

    // 3. Un chantier commencé a une date de début — sans elle, aucune barre ne
    //    peut être placée sur la frise.
    if (["en-cours", "partiel", "termine"].includes(e.statut) && !e.debut) {
      erreurs.push(`${ou} est « ${e.statut} » mais n'a pas de date de début.`);
    }

    // 4. Une fin antérieure au début produirait une barre de largeur négative.
    if (e.fin && e.debut && e.fin < e.debut) {
      erreurs.push(
        `${ou} : fin (${e.fin}) est antérieure au début (${e.debut}).`,
      );
    }
  }

  // 5. Deux ordres identiques rendent la frise non déterministe : l'ordre des
  //    lignes dépendrait alors du tri de lecture du dossier.
  const vus = new Map();
  for (const e of epiques) {
    if (e.ordre_public === undefined) continue;
    if (vus.has(e.ordre_public)) {
      erreurs.push(
        `ordre_public ${e.ordre_public} est porté deux fois : ${vus.get(e.ordre_public)} et ${e.fichier}.`,
      );
    } else {
      vus.set(e.ordre_public, e.fichier);
    }
  }

  if (erreurs.length > 0) {
    console.error(
      `\n[suivi] ${erreurs.length} incohérence(s) dans le frontmatter des épiques :\n` +
        erreurs.map((m) => `  · ${m}`).join("\n") +
        `\n\nLa page de suivi n'est pas générée. Corrigez le frontmatter — une frise fausse est pire qu'une frise absente.\n`,
    );
    process.exit(1);
  }
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
  valider(toutes);

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
