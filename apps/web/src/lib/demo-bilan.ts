// ⚠️ DONNÉES DE DÉMONSTRATION — le Bilan et l'Usage ne sont PAS encore reliés
// au journal ni au compteur d'inférence (décision du 2026-09-20, `ecarts`) :
// les pages existent pour poser la disposition et le vocabulaire, et le disent
// à l'utilisateur (DemoNotice). Le branchement viendra avec M14.5 (plafond par
// compte) et la lecture du journal. Ce module est le SEUL domicile de ces
// chiffres : quand ils deviennent réels, il disparaît.

export type BilanTile = { value: number; label: string };

export const BILAN_DEMO = {
  /** « Ce que Relvo a fait pour vous » — cumulatif (invariant 37). */
  relvo: {
    mois: [
      { value: 412, label: "messages lus" },
      { value: 23, label: "sujets ouverts" },
      { value: 57, label: "tâches créées" },
      { value: 19, label: "brouillons préparés" },
      { value: 31, label: "contacts reconnus" },
      { value: 6, label: "sources en sourdine" },
    ],
    tout: [
      { value: 1284, label: "messages lus" },
      { value: 71, label: "sujets ouverts" },
      { value: 168, label: "tâches créées" },
      { value: 54, label: "brouillons préparés" },
      { value: 89, label: "contacts reconnus" },
      { value: 14, label: "sources en sourdine" },
    ],
  } satisfies Record<string, BilanTile[]>,
  /** « Où en êtes-vous » — un flux sur sept jours, jamais mêlé au cumulatif. */
  flux: {
    messagesParJour: [
      { jour: "lun", n: 14 },
      { jour: "mar", n: 18 },
      { jour: "mer", n: 11 },
      { jour: "jeu", n: 22 },
      { jour: "ven", n: 16 },
      { jour: "sam", n: 3 },
      { jour: "dim", n: 2 },
    ],
    sujetsOuverts: 9,
    sujetsFermes: 4,
    tachesFaites: 12,
    tachesDues: 17,
    delaiMedian: "4 h",
    enRetard: 1,
  },
};

/** La part du plafond mensuel d'inférence consommée, en pourcentage — jamais en euros (invariant 38). */
export const USAGE_DEMO = { percent: 32 };
