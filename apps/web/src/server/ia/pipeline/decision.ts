import { type SortieTri } from "../schemas";

// La DÉCISION du tri (M7, tranche 4) — de la sortie du modèle à ce que le
// pipeline a le droit d'écrire. Module PUR : les deux frontières de confiance
// et l'ordre des règles sont ici, en un seul endroit, et testés.
//
// L'avis du modèle a deux parts — une ACTION (à traiter, à considérer, rien à
// faire) et une NATURE (professionnel, publicité, automatique, personnel) — et
// la décision les lit dans cet ordre :
//
//   1. LE RATTACHEMENT PRIME (`05 §1.2`). Si le fil prolonge un sujet ouvert —
//      réponse, confirmation, accusé que ce sujet attendait —, il lui est
//      rattaché QUELLE QUE SOIT l'action : « rien à faire » veut alors dire
//      qu'aucune tâche nouvelle n'en sort, pas que le sujet n'a pas besoin de
//      ce message. Un accusé de réception attendu ne part jamais en sourdine.
//      Nature professionnelle ou automatique — un accusé EST un automate — et
//      confiance suffisante exigées : ni une publicité ni un fil personnel ne
//      se rattachent à un sujet.
//   2. « À traiter » au-dessus de la frontière de confiance : un sujet s'ouvre
//      (`05 §1.1`). Sous la frontière, l'avis seul est écrit, la conversation
//      reste à trier, sa raison visible — une décision active, sans coût.
//      Un fil PERSONNEL n'ouvre jamais rien : le dirigeant tranche. Une
//      publicité « à traiter » (une offre qui le nomme et attend un oui ou un
//      non) ou un automate « à traiter » (un prélèvement refusé) ouvrent bien.
//   3. « Rien à faire » en confiance HAUTE fait taire la source (`05 §9.5`) :
//      la conversation passe en « ignorée », la nature pour raison, la phrase
//      en note, réversible d'un appui. En dessous, l'avis seul.
//   4. « À considérer » : l'avis seul, quelle que soit la confiance.
//
// Les deux frontières sont posées par défaut, faute de chiffres discriminants
// sur la démonstration (tous les avis y sortent en confiance haute), et se
// règlent sur le journal des usages réels (`backlog/ecarts-et-propositions.md`).

export type Confiance = SortieTri["confiance"];
export type Nature = SortieTri["nature"];

/** Ouvre ou rattache si la confiance est AU MOINS celle-ci. */
export const FRONTIERE_CONFIANCE: Confiance = "moyenne";
/** Fait taire un « rien à faire » si la confiance est AU MOINS celle-ci. */
export const FRONTIERE_IGNORANCE: Confiance = "haute";

const RANG: Record<Confiance, number> = { basse: 0, moyenne: 1, haute: 2 };

export type DecisionTri =
  | {
      type: "avis-seul";
      motif:
        | "a-considerer"
        | "rien-a-faire"
        | "sous-la-frontiere"
        | "personnel";
    }
  | { type: "ignorer"; nature: Nature; raison: string }
  | {
      type: "rattacher";
      sujetExistant: string;
      domaine: string | null;
      domainePropose: string | null;
      priorite: "normal" | "urgent";
    }
  | {
      type: "ouvrir";
      titre: string | null;
      domaine: string | null;
      domainePropose: string | null;
      priorite: "normal" | "urgent";
    };

/** Ce que le pipeline fait de la sortie — rien d'autre n'est jamais écrit. */
export function deciderTri(
  sortie: SortieTri,
  frontieres: { affaire?: Confiance; ignorance?: Confiance } = {},
): DecisionTri {
  const affaire = frontieres.affaire ?? FRONTIERE_CONFIANCE;
  const ignorance = frontieres.ignorance ?? FRONTIERE_IGNORANCE;
  const assezSur = RANG[sortie.confiance] >= RANG[affaire];
  const personnel = sortie.nature === "personnel";
  const rattachable =
    sortie.nature === "professionnel" || sortie.nature === "automatique";

  const sujetExistant = nonVide(sortie.sujet_existant);
  if (sujetExistant && rattachable && assezSur) {
    return {
      type: "rattacher",
      sujetExistant,
      domaine: nonVide(sortie.domaine),
      domainePropose: nonVide(sortie.domaine_propose),
      priorite: sortie.priorite,
    };
  }

  if (sortie.action === "a_traiter") {
    if (personnel) return { type: "avis-seul", motif: "personnel" };
    if (!assezSur) return { type: "avis-seul", motif: "sous-la-frontiere" };
    return {
      type: "ouvrir",
      titre: nonVide(sortie.titre),
      domaine: nonVide(sortie.domaine),
      domainePropose: nonVide(sortie.domaine_propose),
      priorite: sortie.priorite,
    };
  }

  if (sortie.action === "rien_a_faire") {
    if (RANG[sortie.confiance] >= RANG[ignorance]) {
      return {
        type: "ignorer",
        nature: sortie.nature,
        raison: raisonEnBase(sortie.raison),
      };
    }
    return { type: "avis-seul", motif: "rien-a-faire" };
  }

  return { type: "avis-seul", motif: "a-considerer" };
}

function nonVide(s: string | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function raisonEnBase(raison: string): string {
  return raison.trim() || "Sans raison donnée.";
}

// Le schéma de sortie parle français (`schemas.ts`), la base anglais (énumérés
// Prisma) : la traduction se fait ici, une fois. Les valeurs de droite sont
// celles de `TriageVerdict`, `TriageNature` et `TriageConfidence`.

export const ACTION_EN_BASE = {
  a_traiter: "matter",
  a_considerer: "uncertain",
  rien_a_faire: "noise",
} as const;

export const NATURE_EN_BASE = {
  professionnel: "professional",
  publicite: "advertising",
  automatique: "automatic",
  personnel: "personal",
} as const;

export const CONFIANCE_EN_BASE = {
  haute: "high",
  moyenne: "medium",
  basse: "low",
} as const;

export type AvisEnBase = {
  verdict: (typeof ACTION_EN_BASE)[SortieTri["action"]];
  nature: (typeof NATURE_EN_BASE)[Nature];
  confidence: (typeof CONFIANCE_EN_BASE)[Confiance];
  reason: string;
};

export function avisEnBase(sortie: SortieTri): AvisEnBase {
  return {
    verdict: ACTION_EN_BASE[sortie.action],
    nature: NATURE_EN_BASE[sortie.nature],
    confidence: CONFIANCE_EN_BASE[sortie.confiance],
    reason: raisonEnBase(sortie.raison),
  };
}
