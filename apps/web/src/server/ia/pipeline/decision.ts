import { type SortieTri } from "../schemas";

// La DÉCISION du tri (M7, tranche 4) — de la sortie du modèle à ce que le
// pipeline a le droit d'écrire. Module PUR : la frontière de confiance et le
// traitement de « incertain » sont ici, en un seul endroit, et testés.
//
// `05 §1.1` : sous la frontière entre moyenne et basse, l'IA ne crée ni sujet
// ni contact ; la conversation reste orpheline, comptée dans « Sans sujet », sa
// raison visible dans la liste à trier. C'est une décision active, sans coût.
// La frontière se règle sur le jeu d'évaluation (`05 §9.7`) — sur le jeu de
// démonstration, tous les verdicts sortent en confiance haute : elle est posée
// par défaut à « moyenne » et se réglera sur le journal des usages réels
// (`backlog/ecarts-et-propositions.md`, « Frontière de confiance et verdict
// incertain »).

export type Confiance = SortieTri["confiance"];

/** Ouvre ou rattache si la confiance est AU MOINS celle-ci. */
export const FRONTIERE_CONFIANCE: Confiance = "moyenne";

const RANG: Record<Confiance, number> = { basse: 0, moyenne: 1, haute: 2 };

export type DecisionTri =
  | {
      type: "verdict-seul";
      motif: "bruit" | "incertain" | "sous-la-frontiere";
    }
  | {
      type: "affaire";
      sujetExistant: string | null;
      titre: string | null;
      domaine: string | null;
      domainePropose: string | null;
      priorite: "normal" | "urgent";
    };

/** Ce que le pipeline fait de la sortie — rien d'autre n'est jamais écrit. */
export function deciderTri(
  sortie: SortieTri,
  frontiere: Confiance = FRONTIERE_CONFIANCE,
): DecisionTri {
  if (sortie.verdict === "bruit")
    return { type: "verdict-seul", motif: "bruit" };
  if (sortie.verdict === "incertain") {
    return { type: "verdict-seul", motif: "incertain" };
  }
  if (RANG[sortie.confiance] < RANG[frontiere]) {
    return { type: "verdict-seul", motif: "sous-la-frontiere" };
  }
  return {
    type: "affaire",
    sujetExistant: nonVide(sortie.sujet_existant),
    titre: nonVide(sortie.titre),
    domaine: nonVide(sortie.domaine),
    domainePropose: nonVide(sortie.domaine_propose),
    priorite: sortie.priorite,
  };
}

function nonVide(s: string | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

// Le schéma de sortie parle français (`schemas.ts`), la base anglais (énumérés
// Prisma) : la traduction se fait ici, une fois. Les valeurs de droite sont
// celles de `TriageVerdict`, `TriageConfidence` et `IgnoreReason`.

export const VERDICT_EN_BASE = {
  bruit: "noise",
  affaire: "matter",
  incertain: "uncertain",
} as const;

export const CONFIANCE_EN_BASE = {
  haute: "high",
  moyenne: "medium",
  basse: "low",
} as const;

export type VerdictEnBase = {
  verdict: (typeof VERDICT_EN_BASE)[SortieTri["verdict"]];
  confidence: (typeof CONFIANCE_EN_BASE)[Confiance];
  /** Renseignée si et seulement si le verdict est « bruit » (contrainte en base). */
  noiseReason: SortieTri["categorie_bruit"];
  reason: string;
};

export function verdictEnBase(sortie: SortieTri): VerdictEnBase {
  return {
    verdict: VERDICT_EN_BASE[sortie.verdict],
    confidence: CONFIANCE_EN_BASE[sortie.confiance],
    noiseReason: sortie.verdict === "bruit" ? sortie.categorie_bruit : null,
    reason: sortie.raison.trim() || "Sans raison donnée.",
  };
}
