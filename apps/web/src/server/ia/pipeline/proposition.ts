import type {
  SortieRelecture,
  SortieStructuration,
  TacheProposee,
} from "../schemas";

// LA RETENUE DE LA PROPOSITION (M7, tranche 5) — de la sortie du modèle à ce
// que la structuration a le droit d'écrire. Module PUR, testé sans base : les
// plafonds, les règles de date, la résolution des provenances et ce qui est
// écarté sont ici, en un seul endroit.
//
// Ce que la retenue garantit, et que rien d'autre ne garantit :
//   1. Aucune tâche vide, en double, ni au-delà du plafond — un message n'a
//      jamais dix choses à faire (05 §2.2 : ne rien proposer vaut autant).
//   2. Les dates respectent la sémantique asymétrique (02, Task) : la deadline
//      vit dans le début ; une fin sans début, une heure sans date, une heure
//      de fin sans heure de début sont retirées.
//   3. Une provenance est RÉSOLUE contre ce que le modèle a eu sous les yeux —
//      la référence d'un précédent, le titre d'une instruction ou d'un
//      document — et devient lisible : « d'après SUB-0042 · Ouverture Béziers ».
//      Ce qui ne se résout pas reste une source libre, jamais inventée en
//      référence.
//   4. Les étiquettes viennent du registre et de nulle part ailleurs (05 §9.3) ;
//      l'étiquette nouvelle et les questions sont conservées pour le journal
//      seulement — les matérialiser est M17 (registre, questions).
//   5. Le contact n'est complété que s'il existe et selon son statut ; le
//      domaine proposé n'est posé que sur un sujet sans domaine ni proposition.

/** Tâches déductibles au plus par structuration. */
export const PLAFOND_TACHES = 6;
/** Tâches ajoutées au plus par relecture — un message n'a jamais six choses de plus à faire. */
export const PLAFOND_TACHES_RELECTURE = 4;
/** Questions de Relvo conservées au plus par structuration (journal). */
export const PLAFOND_QUESTIONS = 3;

export type Provenance = {
  type: "precedent" | "instruction" | "document" | "autre";
  reference: string | null;
  libelle: string;
};

export type DecisionRetenue = {
  id: string;
  question: string;
  precision: string | null;
  options: string[];
};

export type TacheRetenue = {
  titre: string;
  type: TacheProposee["type"];
  date: string | null;
  heure: string | null;
  dateFin: string | null;
  heureFin: string | null;
  raison: string;
  provenance: Provenance | null;
  /** Les décisions retenues — seulement sur une tâche qui se répond (05 §3.1). */
  decisions: DecisionRetenue[];
};

/** Décisions par tâche, et options par décision : un formulaire se lit d'un coup d'œil. */
export const PLAFOND_DECISIONS = 3;
export const PLAFOND_OPTIONS = 4;
const TYPES_QUI_SE_REPONDENT: readonly TacheProposee["type"][] = [
  "reply",
  "decision",
];

/**
 * Les décisions retenues d'une tâche : sur une tâche qui se répond seulement,
 * au plus trois, chacune avec une question et de deux à quatre options
 * distinctes et courtes ; le reste est écarté, et dit.
 */
export function retenirDecisions(
  proposees: readonly TacheProposee["decisions"][number][],
  type: TacheProposee["type"],
  titre: string,
  ecarts: string[],
): DecisionRetenue[] {
  if (proposees.length === 0) return [];
  if (!TYPES_QUI_SE_REPONDENT.includes(type)) {
    ecarts.push(`${titre} : décisions sur une tâche qui ne se répond pas`);
    return [];
  }
  const retenues: DecisionRetenue[] = [];
  for (const d of proposees) {
    const question = nonVide(d.question);
    if (!question) {
      ecarts.push(`${titre} : décision sans question`);
      continue;
    }
    if (retenues.length >= PLAFOND_DECISIONS) {
      ecarts.push(
        `${titre} : plafond de ${PLAFOND_DECISIONS} décisions : ${question}`,
      );
      continue;
    }
    const options: string[] = [];
    for (const o of d.options) {
      const v = nonVide(o)?.slice(0, 80);
      if (!v || options.some((x) => cle(x) === cle(v))) continue;
      if (options.length >= PLAFOND_OPTIONS) {
        ecarts.push(
          `${question} : plafond de ${PLAFOND_OPTIONS} options : ${v}`,
        );
        continue;
      }
      options.push(v);
    }
    if (options.length < 2) {
      ecarts.push(`${question} : moins de deux options`);
      continue;
    }
    retenues.push({
      id: `d${retenues.length + 1}`,
      question: question.slice(0, 200),
      precision: nonVide(d.precision)?.slice(0, 200) ?? null,
      options,
    });
  }
  return retenues;
}

export type ContactRetenu = {
  prenom: string | null;
  nom: string | null;
  entreprise: string | null;
  role: NonNullable<SortieStructuration["contact"]>["role"];
  telephone: string | null;
  email: string | null;
};

export type PropositionRetenue = {
  situation: {
    ouOnEnEst: string | null;
    prochaineEtape: string | null;
    attente: string | null;
    echeance: string | null;
  };
  resume: string | null;
  taches: TacheRetenue[];
  contact: ContactRetenu | null;
  etiquettes: string[];
  /** Journal seulement (M17.4). */
  etiquetteNouvelle: string | null;
  /** Journal seulement (M17.6). */
  questions: SortieStructuration["questions"];
  domainePropose: string | null;
  /** Ce qui a été écarté, pour le journal et le banc d'essai. */
  ecarts: string[];
};

/** Ce que le modèle avait sous les yeux, et l'état du sujet — de quoi résoudre et filtrer. */
export type CadreRetenue = {
  registre: readonly string[];
  precedents: readonly { reference: string; titre: string }[];
  instructions: readonly string[];
  documents: readonly string[];
  domaineConnu: boolean;
  domaineProposeExistant: string | null;
  /** « aucun » : groupe ou sujet sans contact ; sinon le statut de la fiche. */
  contact: "aucun" | "auto" | "complete";
};

function nonVide(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function cle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REFERENCE = /\b([A-Z]{2,5}-\d{3,6})\b/;

/**
 * Résout une provenance libre contre le cadre : une référence de précédent,
 * le titre d'une instruction ou d'un document. Insensible à la casse et aux
 * accents ; une référence inconnue du cadre n'est PAS reconnue comme un
 * précédent — le modèle ne cite que ce qu'il a lu.
 */
export function resoudreProvenance(
  brut: string | null,
  cadre: Pick<CadreRetenue, "precedents" | "instructions" | "documents">,
): Provenance | null {
  const texte = nonVide(brut);
  if (!texte) return null;
  const ref = texte.match(REFERENCE)?.[1];
  if (ref) {
    const p = cadre.precedents.find((x) => x.reference === ref);
    if (p)
      return { type: "precedent", reference: p.reference, libelle: p.titre };
  }
  const k = cle(texte);
  const instruction = cadre.instructions.find(
    (i) =>
      cle(i) === k ||
      (k.length >= 6 && cle(i).includes(k)) ||
      k.includes(cle(i)),
  );
  if (instruction) {
    return { type: "instruction", reference: null, libelle: instruction };
  }
  const document = cadre.documents.find(
    (d) =>
      cle(d) === k ||
      (k.length >= 6 && cle(d).includes(k)) ||
      k.includes(cle(d)),
  );
  if (document) return { type: "document", reference: null, libelle: document };
  return { type: "autre", reference: null, libelle: texte.slice(0, 300) };
}

/** Les dates d'une tâche, mises en conformité avec 02 (Task) ; dit ce qui a été retiré. */
export function retenirDates(
  t: Pick<TacheProposee, "date" | "heure" | "date_fin" | "heure_fin">,
): {
  date: string | null;
  heure: string | null;
  dateFin: string | null;
  heureFin: string | null;
  retire: string[];
} {
  const retire: string[] = [];
  const date = t.date;
  const heure = t.heure;
  let dateFin = t.date_fin;
  let heureFin = t.heure_fin;
  if (!date) {
    if (heure || dateFin || heureFin) retire.push("heure ou fin sans date");
    return { date: null, heure: null, dateFin: null, heureFin: null, retire };
  }
  if (dateFin && dateFin < date) {
    retire.push("date de fin avant le début");
    dateFin = null;
  }
  if (dateFin === date) dateFin = null;
  if (heureFin && !heure) {
    retire.push("heure de fin sans heure de début");
    heureFin = null;
  }
  if (heureFin && heure && !dateFin && heureFin <= heure) {
    retire.push("heure de fin avant l'heure de début");
    heureFin = null;
  }
  return { date, heure, dateFin, heureFin, retire };
}

/**
 * Les tâches retenues d'une proposition : titre non vide, sans doublon —
 * entre elles et avec les tâches DÉJÀ OUVERTES du sujet —, plafonnées, dates
 * conformes, provenance résolue. Ce qui est écarté est dit.
 */
export function retenirTaches(
  proposees: readonly TacheProposee[],
  cadre: Pick<CadreRetenue, "precedents" | "instructions" | "documents">,
  options: { plafond: number; dejaOuvertes?: readonly string[] },
  ecarts: string[],
): TacheRetenue[] {
  const vus = new Set((options.dejaOuvertes ?? []).map(cle));
  const taches: TacheRetenue[] = [];
  for (const t of proposees) {
    const titre = nonVide(t.titre);
    if (!titre) {
      ecarts.push("tâche sans titre");
      continue;
    }
    const k = cle(titre);
    if (vus.has(k)) {
      ecarts.push(`tâche en double : ${titre}`);
      continue;
    }
    if (taches.length >= options.plafond) {
      ecarts.push(`plafond de ${options.plafond} tâches : ${titre}`);
      continue;
    }
    vus.add(k);
    const dates = retenirDates(t);
    for (const r of dates.retire) ecarts.push(`${titre} : ${r}`);
    taches.push({
      titre: titre.slice(0, 300),
      type: t.type,
      date: dates.date,
      heure: dates.heure,
      dateFin: dates.dateFin,
      heureFin: dates.heureFin,
      raison: (nonVide(t.raison) ?? "").slice(0, 1000),
      provenance: resoudreProvenance(t.provenance, cadre),
      decisions: retenirDecisions(t.decisions, t.type, titre, ecarts),
    });
  }
  return taches;
}

/** Les étiquettes retenues : celles du registre, insensibles à la casse et aux accents, et rien d'autre (05 §9.3). */
function retenirEtiquettes(
  proposees: readonly string[],
  registre: Map<string, string>,
  ecarts: string[],
): string[] {
  const etiquettes: string[] = [];
  for (const e of proposees) {
    const r = registre.get(cle(e));
    if (!r) {
      ecarts.push(`étiquette hors registre : ${e}`);
      continue;
    }
    if (!etiquettes.includes(r)) etiquettes.push(r);
  }
  return etiquettes;
}

/** Ce que la structuration écrira — rien d'autre n'est jamais écrit. */
export function retenirProposition(
  sortie: SortieStructuration,
  cadre: CadreRetenue,
): PropositionRetenue {
  const ecarts: string[] = [];

  const taches = retenirTaches(
    sortie.taches,
    cadre,
    { plafond: PLAFOND_TACHES },
    ecarts,
  );

  // Contact : seulement s'il y en a un à compléter. Le domaine décide ensuite
  // ce que le statut autorise ; ici on ne pousse rien vers un sujet sans contact.
  let contact: ContactRetenu | null = null;
  if (sortie.contact) {
    if (cadre.contact === "aucun") {
      ecarts.push("contact proposé sur un sujet sans contact");
    } else {
      const email = nonVide(sortie.contact.email);
      contact = {
        prenom: nonVide(sortie.contact.prenom),
        nom: nonVide(sortie.contact.nom),
        entreprise: nonVide(sortie.contact.entreprise),
        role: sortie.contact.role,
        telephone: nonVide(sortie.contact.telephone)?.slice(0, 40) ?? null,
        // Une adresse seulement si elle en a la forme.
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      };
    }
  }

  // Étiquettes : du registre, et rien d'autre.
  const registre = new Map(cadre.registre.map((r) => [cle(r), r]));
  const etiquettes = retenirEtiquettes(sortie.etiquettes, registre, ecarts);
  const etiquetteNouvelle = nonVide(sortie.etiquette_nouvelle);
  if (etiquetteNouvelle && registre.has(cle(etiquetteNouvelle))) {
    // « Nouvelle » mais déjà connue : c'est une étiquette du registre.
    const r = registre.get(cle(etiquetteNouvelle))!;
    if (!etiquettes.includes(r)) etiquettes.push(r);
  }

  // Domaine proposé : un sujet classé n'en a pas besoin ; une proposition
  // déjà posée par le tri n'est pas remplacée.
  const domainePropose =
    !cadre.domaineConnu && !cadre.domaineProposeExistant
      ? nonVide(sortie.domaine_propose)
      : null;
  if (sortie.domaine_propose && !domainePropose) {
    ecarts.push("domaine proposé sur un sujet déjà classé ou déjà proposé");
  }

  return {
    situation: {
      ouOnEnEst: nonVide(sortie.situation.ou_on_en_est),
      prochaineEtape: nonVide(sortie.situation.prochaine_etape),
      attente: nonVide(sortie.situation.attente),
      echeance: sortie.situation.echeance,
    },
    resume: nonVide(sortie.resume),
    taches,
    contact,
    etiquettes,
    etiquetteNouvelle:
      etiquetteNouvelle && !registre.has(cle(etiquetteNouvelle))
        ? etiquetteNouvelle
        : null,
    questions: sortie.questions.slice(0, PLAFOND_QUESTIONS),
    domainePropose,
    ecarts,
  };
}

// ─────────────────────────────────────────────────────────────
// La relecture (M7, tranche 6) — ce qu'un message entrant a le droit de changer
// ─────────────────────────────────────────────────────────────

/** Ce que la relecture avait sous les yeux, et l'état du sujet avant l'appel. */
export type CadreRelecture = Pick<
  CadreRetenue,
  "registre" | "precedents" | "instructions" | "documents"
> & {
  /** Titres des tâches encore ouvertes : une tâche proposée qui les répète est écartée. */
  tachesOuvertes: readonly string[];
  /** Relvo avait déjà suggéré la clôture. */
  resolutionSuggeree: boolean;
};

export type RelectureRetenue = {
  situation: PropositionRetenue["situation"];
  resume: string | null;
  taches: TacheRetenue[];
  etiquettes: string[];
  priorite: SortieRelecture["priorite"];
  /** Vrai : poser « En attente ». Null : ne pas y toucher — la mécanique a déjà fait le sien (04 §9). */
  enAttente: true | null;
  /** Suggérer la clôture, la retirer, ou ne rien changer (05 §5.5, §8.4, §8.5). */
  resolution: "suggerer" | "revoquer" | "garder";
  /** Tâches ouvertes de la fiche devenues sans objet — par leur titre exact (05 §4.2). */
  tachesObsoletes: { titre: string; raison: string }[];
  /** Tâches ouvertes de la fiche que le message montre accomplies — par leur titre exact (05 §4.2). */
  tachesTerminees: { titre: string; raison: string }[];
  raison: string | null;
  ecarts: string[];
};

/** Tâches retirées par relecture, au plus. */
export const PLAFOND_TACHES_OBSOLETES = 5;
/** Tâches cochées par relecture, au plus. */
export const PLAFOND_TACHES_TERMINEES = 5;

type TacheDeLaFiche = { titre: string; raison: string };

/**
 * Les tâches de la fiche que le modèle désigne — comme sans objet, ou comme
 * accomplies — retenues par leur titre (à la casse et aux accents près), avec
 * une raison ; le reste est écarté, et dit.
 */
function retenirTachesDeLaFiche(
  proposees: readonly TacheDeLaFiche[],
  tachesOuvertes: readonly string[],
  ecarts: string[],
  regle: { libelle: string; plafond: number; raisonParDefaut: string },
): TacheDeLaFiche[] {
  const ouvertes = new Map(tachesOuvertes.map((t) => [cle(t), t]));
  const retenues: TacheDeLaFiche[] = [];
  for (const p of proposees) {
    const titre = nonVide(p.titre);
    if (!titre) continue;
    const exacte = ouvertes.get(cle(titre));
    if (!exacte) {
      ecarts.push(`tâche ${regle.libelle} inconnue de la fiche : ${titre}`);
      continue;
    }
    if (retenues.some((r) => r.titre === exacte)) continue;
    if (retenues.length >= regle.plafond) {
      ecarts.push(
        `plafond de ${regle.plafond} tâches ${regle.libelle}s : ${titre}`,
      );
      continue;
    }
    retenues.push({
      titre: exacte,
      raison: (nonVide(p.raison) ?? regle.raisonParDefaut).slice(0, 500),
    });
  }
  return retenues;
}

/** Les tâches obsolètes retenues (05 §4.2). */
export function retenirTachesObsoletes(
  proposees: readonly TacheDeLaFiche[],
  tachesOuvertes: readonly string[],
  ecarts: string[],
): TacheDeLaFiche[] {
  return retenirTachesDeLaFiche(proposees, tachesOuvertes, ecarts, {
    libelle: "obsolète",
    plafond: PLAFOND_TACHES_OBSOLETES,
    raisonParDefaut: "Ce message la rend sans objet.",
  });
}

/** Les tâches accomplies retenues (05 §4.2). */
export function retenirTachesTerminees(
  proposees: readonly TacheDeLaFiche[],
  tachesOuvertes: readonly string[],
  ecarts: string[],
): TacheDeLaFiche[] {
  return retenirTachesDeLaFiche(proposees, tachesOuvertes, ecarts, {
    libelle: "terminée",
    plafond: PLAFOND_TACHES_TERMINEES,
    raisonParDefaut: "Ce message dit qu'elle est faite.",
  });
}

/**
 * Ce que la relecture écrira — et les deux règles qui ne sont qu'ici :
 *   • la clôture n'est suggérée que si le modèle le dit ET qu'il ne reste
 *     aucune tâche ouverte — ni ancienne, ni retenue à l'instant (05 §5.5 :
 *     « plus de tâches ouvertes ») ; une tâche que ce message coche ou retire
 *     ne compte plus. Dite « terminée » avec des tâches, elle est écartée et
 *     dite. Une tâche nommée à la fois accomplie et sans objet est cochée,
 *     pas retirée — c'est le geste réversible ; Une suggestion en cours est RETIRÉE dès que le
 *     modèle ne conclut plus à la fin (05 §8.5) ; sinon, re-suggérer met
 *     l'horodatage à jour et fait revenir le badge (05 §8.4) ;
 *   • « En attente » n'est posé que si le modèle le dit ET nomme ce qu'on
 *     attend (situation.attente) — un marqueur sans objet n'aide personne ;
 *     il n'est jamais LEVÉ ici : le message entrant l'a déjà levé (04 §9).
 */
export function retenirRelecture(
  sortie: SortieRelecture,
  cadre: CadreRelecture,
): RelectureRetenue {
  const ecarts: string[] = [];
  const taches = retenirTaches(
    sortie.taches,
    cadre,
    { plafond: PLAFOND_TACHES_RELECTURE, dejaOuvertes: cadre.tachesOuvertes },
    ecarts,
  );
  const registre = new Map(cadre.registre.map((r) => [cle(r), r]));
  const etiquettes = retenirEtiquettes(sortie.etiquettes, registre, ecarts);

  const attente = nonVide(sortie.situation.attente);
  let enAttente: true | null = null;
  if (sortie.en_attente) {
    if (attente) enAttente = true;
    else ecarts.push("en attente sans dire de qui : marqueur non posé");
  }

  const tachesTerminees = retenirTachesTerminees(
    sortie.taches_terminees,
    cadre.tachesOuvertes,
    ecarts,
  );
  const cochees = new Set(tachesTerminees.map((t) => cle(t.titre)));
  const tachesObsoletes = retenirTachesObsoletes(
    sortie.taches_obsoletes,
    cadre.tachesOuvertes,
    ecarts,
  ).filter((t) => {
    if (!cochees.has(cle(t.titre))) return true;
    ecarts.push(`tâche à la fois terminée et obsolète, cochée : ${t.titre}`);
    return false;
  });
  const reglees = new Set([
    ...cochees,
    ...tachesObsoletes.map((t) => cle(t.titre)),
  ]);
  const restantes = cadre.tachesOuvertes.filter((t) => !reglees.has(cle(t)));
  const resteAFaire = restantes.length + taches.length > 0;
  let resolution: RelectureRetenue["resolution"] = "garder";
  if (sortie.termine && !resteAFaire) {
    resolution = "suggerer";
  } else {
    if (sortie.termine) {
      ecarts.push("terminé avec des tâches ouvertes : clôture non suggérée");
    }
    if (cadre.resolutionSuggeree) resolution = "revoquer";
  }

  return {
    situation: {
      ouOnEnEst: nonVide(sortie.situation.ou_on_en_est),
      prochaineEtape: nonVide(sortie.situation.prochaine_etape),
      attente,
      echeance: sortie.situation.echeance,
    },
    resume: nonVide(sortie.resume),
    taches,
    etiquettes,
    priorite: sortie.priorite,
    enAttente,
    resolution,
    tachesObsoletes,
    tachesTerminees,
    raison: nonVide(sortie.raison)?.slice(0, 500) ?? null,
    ecarts,
  };
}
