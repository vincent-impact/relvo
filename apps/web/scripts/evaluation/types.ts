import type {
  CompteContexte,
  MessageContexte,
} from "../../src/server/ia/contexte";

/** Le compte au moment de l'extraction — devient la couche Compte du tri. */
export type CompteEvaluation = CompteContexte;

/** Un cas d'évaluation : un fil e-mail et la vérité terrain du tri manuel. */
export type Cas = {
  id: string;
  canal: "email";
  messages: MessageContexte[];
  verite: {
    verdict: "bruit" | "affaire";
    /** Référence du sujet né de ce fil — exclu des « sujets ouverts » poussés au tri. */
    reference: string | null;
    domaine: string | null;
    titre: string | null;
    priorite: "normal" | "urgent" | null;
    taches: { titre: string; type: string; date: string | null }[];
  };
};
