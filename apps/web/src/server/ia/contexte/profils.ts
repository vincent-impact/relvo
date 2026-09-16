import { coucheProduit, estimerJetons } from "../produit";
import {
  blocMessage,
  coucheCompteComplete,
  coucheCompteTri,
  coucheDomaine,
  coucheSituationTri,
  trierParDate,
} from "./couches";
import { blocPrecedents, ficheContact, ficheSujet } from "./fiches";
import { coucheInstant } from "./instant";
import type {
  CompteContexte,
  ContactContexte,
  ConversationContexte,
  DomaineContexte,
  InstantContexte,
  MessageContexte,
  Precedent,
  SujetContexte,
  TacheContexte,
} from "./types";

// Un PROFIL par sollicitation (`05 §10.1`) : tri, structuration, relecture,
// brouillon, étiquette de pièce jointe. Chaque profil dit quelles couches il
// charge et dans quel ordre, et porte un BUDGET par couche, tenu par un test.
//
// ⚠️ `system` ne porte QUE la couche Produit ; tout ce qui varie par compte ou
// par appel va dans `prompt`, du plus stable au plus volatil (PITFALLS.md #49 :
// un octet changé dans le message système annule tout son cache).

export type Couche = "produit" | "compte" | "domaine" | "situation" | "instant";

export type Contexte = {
  system: string;
  prompt: string;
  /** Les blocs, couche par couche, pour la mesure et les tests. */
  couches: Record<Couche, string>;
};

export type Profil =
  | "tri"
  | "structuration"
  | "relecture"
  | "brouillon"
  | "etiquette-piece-jointe";

/**
 * Budgets en jetons (estimés), par profil et par couche. Dépassement = test
 * rouge. La couche Compte du tri porte jusqu'à quarante titres de sujets
 * ouverts (le chargeur plafonne la liste) : des titres, jamais des fiches.
 * La couche Produit vaut le socle plus deux secteurs (`BUDGET_PRODUIT`).
 */
export const BUDGETS: Record<Profil, Record<Couche, number>> = {
  tri: {
    produit: 3_600,
    compte: 1_100,
    domaine: 0,
    situation: 3_000,
    instant: 120,
  },
  structuration: {
    produit: 3_600,
    compte: 1_600,
    domaine: 3_500,
    situation: 4_500,
    instant: 120,
  },
  relecture: {
    produit: 3_600,
    compte: 1_600,
    domaine: 3_500,
    situation: 3_500,
    instant: 120,
  },
  brouillon: {
    produit: 3_600,
    compte: 1_600,
    domaine: 3_500,
    situation: 3_500,
    instant: 120,
  },
  "etiquette-piece-jointe": {
    produit: 3_600,
    compte: 0,
    domaine: 0,
    situation: 300,
    instant: 0,
  },
};

export function mesurerCouches(c: Contexte): Record<Couche, number> {
  return {
    produit: estimerJetons(c.couches.produit),
    compte: estimerJetons(c.couches.compte),
    domaine: estimerJetons(c.couches.domaine),
    situation: estimerJetons(c.couches.situation),
    instant: estimerJetons(c.couches.instant),
  };
}

function assembler(
  couches: Record<Couche, string>,
  question: string,
): Contexte {
  return {
    system: couches.produit,
    prompt: [
      couches.compte,
      couches.domaine,
      couches.instant,
      couches.situation,
      question,
    ]
      .filter(Boolean)
      .join("\n\n"),
    couches,
  };
}

/** TRI (`05 §1.1`) : Produit + Compte (sans instructions) + Instant + le fil. Pas de Domaine. */
export function contexteTri(args: {
  compte: CompteContexte;
  conversation: ConversationContexte;
  instant: InstantContexte;
}): Contexte {
  return assembler(
    {
      produit: coucheProduit(args.compte.secteurs),
      compte: coucheCompteTri(args.compte),
      domaine: "",
      instant: coucheInstant(args.instant.maintenant),
      situation: coucheSituationTri(args.conversation),
    },
    `# Ta décision\nRends ton verdict de tri sur ce fil, avec sa confiance, sa raison, le domaine, l'éventuel sujet existant, le titre et la priorité.`,
  );
}

/** STRUCTURATION (`05 §1.3`–§1.6, §2) : tout — le domaine est connu. */
export function contexteStructuration(args: {
  compte: CompteContexte;
  domaine: DomaineContexte | null;
  sujet: SujetContexte;
  contact: ContactContexte | null;
  precedents: readonly Precedent[];
  instant: InstantContexte;
}): Contexte {
  return assembler(
    {
      produit: coucheProduit(args.compte.secteurs),
      compte: coucheCompteComplete(args.compte),
      domaine: coucheDomaine(args.domaine),
      instant: coucheInstant(args.instant.maintenant),
      situation: [
        ficheSujet(args.sujet, { messages: 5 }),
        args.contact ? ficheContact(args.contact) : null,
        blocPrecedents(args.precedents),
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    [
      `# Ta structuration`,
      `Ce sujet vient d'être ouvert. Rédige sa situation structurée et son résumé, déduis les tâches, complète le contact si sa fiche est automatique ou inconnue, choisis les étiquettes dans le registre, et nomme ce qui te manque pour mieux faire.`,
      `COURT, toujours plus court que le message. Le résumé dit DE QUOI il s'agit en une phrase, deux au plus — jamais ce qu'il y a à faire, ni les dates : les tâches sont là pour ça. « Où on en est » tient en une phrase ; « prochaine étape » nomme UNE action, en quelques mots ; « attente » dit de qui on attend quoi, en quelques mots. Pas de répétition entre ces champs.`,
      `Une tâche par action que le message DEMANDE au dirigeant — répondre, confirmer, décider, envoyer — et aucune s'il est informatif. Une demande explicite (« pouvez-vous confirmer ? ») est toujours une tâche.`,
      `La date d'une tâche va dans ses champs de date, JAMAIS dans son titre : « demain », « avant jeudi », « entre 8 h et 10 h » se lisent par rapport à la date du jour et donnent date, heure et heure de fin. Sans formulation temporelle, aucune date.`,
      `Chaque tâche porte sa raison en une phrase, et sa provenance quand elle vient d'un précédent, d'une instruction ou d'un document que tu as lus — sinon null.`,
    ].join("\n"),
  );
}

/** Fiches de clôture poussées en relecture — une seule : c'est le poste le plus fréquent (`05 §10.1`). */
export const FICHES_PRECEDENTS_RELECTURE = 1;

/**
 * RELECTURE (`05 §5.2`–§5.5) : la fiche — situation structurée, deux derniers
 * messages ANTÉRIEURS —, les précédents (titres, une fiche), et le message qui
 * vient d'arriver, à part. Le poste le plus fréquent : budget serré.
 */
export function contexteRelecture(args: {
  compte: CompteContexte;
  domaine: DomaineContexte | null;
  sujet: SujetContexte;
  precedents: readonly Precedent[];
  nouveauxMessages: readonly MessageContexte[];
  /** Le message a ROUVERT un sujet validé ou fermé — mécaniquement, avant l'appel (`05 §5.2`). */
  rouvert?: boolean;
  instant: InstantContexte;
}): Contexte {
  const nouveaux = trierParDate(args.nouveauxMessages);
  return assembler(
    {
      produit: coucheProduit(args.compte.secteurs),
      compte: coucheCompteComplete(args.compte),
      domaine: coucheDomaine(args.domaine),
      instant: coucheInstant(args.instant.maintenant),
      situation: [
        ficheSujet(args.sujet, { messages: 2 }),
        blocPrecedents(args.precedents, FICHES_PRECEDENTS_RELECTURE),
        `# Ce qui vient d'arriver${args.rouvert ? " — et qui a ROUVERT ce sujet, qui était terminé" : ""}`,
        ...nouveaux.map((m, i) => blocMessage(m, i)),
      ].join("\n\n"),
    },
    [
      `# Ta relecture`,
      `Un message vient d'arriver sur ce sujet suivi. Mets à jour la situation structurée et le résumé à la lumière de ce message${args.rouvert ? " — le sujet était terminé, il repart" : ""}, ajoute UNIQUEMENT les tâches que ce message rend nécessaires (aucune s'il est informatif, et jamais une tâche déjà ouverte dans la fiche), recalibre la priorité — « urgent » sur signal explicite seulement —, et complète les étiquettes si une clé du registre s'impose.`,
      `« en_attente » est vrai quand le sujet attend maintenant un TIERS — une livraison promise, un devis annoncé, un retour attendu — sans qu'aucune action ne revienne au dirigeant. « termine » est vrai quand l'affaire semble réglée : confirmation reçue, plus rien à faire, situation close naturellement. Les deux sont faux dès qu'une tâche revient au dirigeant.`,
      `Mêmes règles qu'à la structuration : COURT, le résumé dit de quoi il s'agit sans les actions ni les dates ; la date d'une tâche va dans ses champs, jamais dans son titre ; chaque tâche porte sa raison et sa provenance quand elle vient d'un précédent, d'une instruction ou d'un document lus. « raison » dit en une phrase ce que ce message change.`,
    ].join("\n"),
  );
}

/** BROUILLON (`05 §3.1`) : la fiche, le contact, la tâche de réponse, les derniers messages. */
export function contexteBrouillon(args: {
  compte: CompteContexte;
  domaine: DomaineContexte | null;
  sujet: SujetContexte;
  contact: ContactContexte | null;
  tache: TacheContexte;
  instant: InstantContexte;
}): Contexte {
  return assembler(
    {
      produit: coucheProduit(args.compte.secteurs),
      compte: coucheCompteComplete(args.compte),
      domaine: coucheDomaine(args.domaine),
      instant: coucheInstant(args.instant.maintenant),
      situation: [
        ficheSujet(args.sujet, { messages: 3 }),
        args.contact ? ficheContact(args.contact) : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    [
      `# Ton brouillon`,
      `Rédige la réponse qui accomplit la tâche « ${args.tache.titre} », au nom du dirigeant, dans le ton des échanges précédents, sans rien inventer. Texte seul, prêt à envoyer, sans objet ni signature.`,
      `Si la tâche suppose une décision que le dirigeant n'a pas encore prise, tu rédiges quand même : la réponse pose le cadre et laisse le choix entre crochets, par exemple « nous retenons le modèle [8 m³ / 12 m³] ». Tu ne refuses jamais de rédiger, et tu ne décides jamais à sa place.`,
    ].join("\n"),
  );
}

/** ÉTIQUETTE D'UNE PIÈCE JOINTE (`05 §6.1`) : ne charge presque rien. */
export function contexteEtiquettePieceJointe(args: {
  compte: CompteContexte;
  nomFichier: string;
  typeMime: string | null;
  extrait: string | null;
}): Contexte {
  return assembler(
    {
      produit: coucheProduit(args.compte.secteurs),
      compte: "",
      domaine: "",
      instant: "",
      situation: [
        `# Pièce jointe`,
        `Fichier : ${args.nomFichier}${args.typeMime ? ` (${args.typeMime})` : ""}`,
        args.extrait
          ? `Extrait :\n${args.extrait.slice(0, 800)}`
          : `Aucun extrait lisible.`,
      ].join("\n"),
    },
    `# Ton étiquette\nDonne une catégorie courte à cette pièce jointe (devis, facture, bon de livraison, contrat, photo, autre…).`,
  );
}
