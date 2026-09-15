import type { SortieStructuration, TacheProposee } from "../schemas";

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
/** Questions de Relvo conservées au plus par structuration (journal). */
export const PLAFOND_QUESTIONS = 3;

export type Provenance = {
  type: "precedent" | "instruction" | "document" | "autre";
  reference: string | null;
  libelle: string;
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
};

export type ContactRetenu = {
  prenom: string | null;
  nom: string | null;
  entreprise: string | null;
  role: NonNullable<SortieStructuration["contact"]>["role"];
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

/** Ce que la structuration écrira — rien d'autre n'est jamais écrit. */
export function retenirProposition(
  sortie: SortieStructuration,
  cadre: CadreRetenue,
): PropositionRetenue {
  const ecarts: string[] = [];

  // Tâches : titre non vide, sans doublon, plafonnées, dates conformes,
  // provenance résolue.
  const vus = new Set<string>();
  const taches: TacheRetenue[] = [];
  for (const t of sortie.taches) {
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
    if (taches.length >= PLAFOND_TACHES) {
      ecarts.push(`plafond de ${PLAFOND_TACHES} tâches : ${titre}`);
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
    });
  }

  // Contact : seulement s'il y en a un à compléter. Le domaine décide ensuite
  // ce que le statut autorise ; ici on ne pousse rien vers un sujet sans contact.
  let contact: ContactRetenu | null = null;
  if (sortie.contact) {
    if (cadre.contact === "aucun") {
      ecarts.push("contact proposé sur un sujet sans contact");
    } else {
      contact = {
        prenom: nonVide(sortie.contact.prenom),
        nom: nonVide(sortie.contact.nom),
        entreprise: nonVide(sortie.contact.entreprise),
        role: sortie.contact.role,
      };
    }
  }

  // Étiquettes : du registre, et rien d'autre.
  const registre = new Map(cadre.registre.map((r) => [cle(r), r]));
  const etiquettes: string[] = [];
  for (const e of sortie.etiquettes) {
    const r = registre.get(cle(e));
    if (!r) {
      ecarts.push(`étiquette hors registre : ${e}`);
      continue;
    }
    if (!etiquettes.includes(r)) etiquettes.push(r);
  }
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
