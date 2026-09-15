// Filtre DÉTERMINISTE de la publicité (M7, tranche 4 ; `05 §9.5`, premier
// dispositif) — AVANT tout appel au modèle, zéro jeton. Un en-tête de
// désabonnement, un envoi marqué « bulk », un lien de désabonnement en fin de
// message : ces fils ne sollicitent personne et ne prolongent aucun sujet. Ils
// reçoivent un avis « rien à faire · publicité » avec sa règle, et la source
// est mise en sourdine.
//
// Les signaux d'AUTOMATE — expéditeur sans réponse possible, en-tête
// auto-submitted, objet d'accusé ou de réponse automatique — ne concluent
// PLUS ici : une confirmation de commande ou un accusé de réception est
// souvent le message qu'un sujet ouvert ATTENDAIT, et seul le modèle, qui voit
// les sujets ouverts, peut le rattacher (`05 §1.2`). Ils sont relevés par
// `signauxAutomatiques` et poussés au modèle comme indices : la nature
// « automatique » lui coûte alors une ligne, et le rattachement reste possible.
//
// Module PUR, sans base ni fournisseur. Les règles sont volontairement
// PRUDENTES : dans le doute, on laisse passer au modèle — un vrai message
// mis en sourdine coûte plus cher qu'un appel de tri.

export type EntreeBruit = {
  /** Adresse brute de l'expéditeur. */
  adresse: string | null;
  /** Nom d'affichage de l'expéditeur, s'il y en a un. */
  nom: string | null;
  objet: string | null;
  contenu: string;
  /**
   * En-têtes de l'e-mail, clés en minuscules, quand le transport les fournit.
   * Le webhook actuel ne les expose pas : le champ est là pour le jour où ils
   * arrivent, et les règles fonctionnent sans.
   */
  entetes?: Readonly<Record<string, string | readonly string[] | undefined>>;
};

export type VerdictBruit = {
  nature: "publicite";
  /** Nom court de la règle qui a conclu — journalisé, visible dans la liste à trier. */
  regle: string;
  raison: string;
};

/** Parties locales d'adresses qui ne lisent jamais de réponse. */
const EXPEDITEUR_SANS_REPONSE: readonly RegExp[] = [
  /^(no|ne)[-_.]?(t)?[-_.]?(reply|repondre|répondre)/i,
  /^do[-_.]?not[-_.]?(reply|repondre|répondre)/i,
  /^nepasrepondre/i,
  /^(ne[-_.]?pas[-_.]?repondre|ne[-_.]?pas[-_.]?répondre)/i,
  /^mailer[-_.]?daemon$/i,
  /^postmaster$/i,
  /^(bounce|bounces)(\W|$)/i,
  /^(notification|notifications|notify|alert|alerts|alerte|alertes)(\W|$)/i,
  /^(newsletter|newsletters|news|mailing|marketing|promo|promotions?)(\W|$)/i,
  /^(auto|automated|automatique|robot|daemon|system)(\W|$)/i,
];

/** Objets d'accusés et de réponses automatiques, français et anglais. */
const OBJET_AUTOMATIQUE: readonly RegExp[] = [
  /^(re\s*:\s*)?(réponse|reponse) automatique/i,
  /^(re\s*:\s*)?automatic reply/i,
  /^(re\s*:\s*)?auto(matic)?[- ]?(reply|response)/i,
  /^(re\s*:\s*)?out of (the )?office/i,
  /^(re\s*:\s*)?absen(ce|t) du bureau/i,
  /^(re\s*:\s*)?accusé de réception/i,
  /^(re\s*:\s*)?(delivery status notification|undeliverable|undelivered mail|mail delivery (failed|failure))/i,
  /^(re\s*:\s*)?(échec|echec) de (la )?(remise|livraison)/i,
  /^(re\s*:\s*)?(notification de )?non[- ]remise/i,
];

/** Formules de désabonnement — cherchées en FIN de message, avec un lien. */
const DESABONNEMENT: RegExp =
  /(se |vous )?d[ée]sabonner|d[ée]sinscri(re|ption)|unsubscribe|ne plus recevoir (ces|nos|les) (e-?mails|messages|communications)|g[ée]rer (vos|mes) (pr[ée]f[ée]rences|abonnements)|manage (your )?(preferences|subscription)/i;

const LIEN = /https?:\/\/\S+/i;

function entete(entetes: EntreeBruit["entetes"], nom: string): string | null {
  if (!entetes) return null;
  const v = entetes[nom];
  if (v === undefined) return null;
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function partieLocale(adresse: string | null): string {
  const a = (adresse ?? "").trim().toLowerCase();
  const at = a.indexOf("@");
  return at > 0 ? a.slice(0, at) : a;
}

/**
 * Rend un avis « rien à faire · publicité » quand une règle déterministe
 * conclut, sinon null — et null veut dire « au modèle de décider », pas « pas
 * de la publicité ».
 */
export function detecterBruitDeterministe(e: EntreeBruit): VerdictBruit | null {
  // 1. En-têtes, quand ils existent : les signaux les plus sûrs.
  if (entete(e.entetes, "list-unsubscribe")) {
    return {
      nature: "publicite",
      regle: "en-tete-desabonnement",
      raison: "Envoi en masse : l'e-mail porte un en-tête de désabonnement.",
    };
  }
  const precedence = entete(e.entetes, "precedence");
  if (precedence && /^(bulk|list|junk)$/i.test(precedence.trim())) {
    return {
      nature: "publicite",
      regle: "en-tete-precedence",
      raison:
        "Envoi en masse : l'e-mail est marqué « bulk » par son expéditeur.",
    };
  }

  // 2. Lien de désabonnement en fin de message : envoi en masse. Le corps doit
  //    porter un lien ET la formule dans son dernier tiers — un client qui écrit
  //    « je souhaite me désabonner » en deux lignes n'a ni lien ni fin de page.
  const contenu = e.contenu.trim();
  if (contenu.length >= 400 && LIEN.test(contenu)) {
    const queue = contenu.slice(Math.floor(contenu.length * (2 / 3)));
    if (DESABONNEMENT.test(queue)) {
      return {
        nature: "publicite",
        regle: "lien-desabonnement",
        raison:
          "Envoi en masse : le message se termine par un lien de désabonnement.",
      };
    }
  }

  return null;
}

/**
 * Les indices d'AUTOMATE, en clair, pour le modèle — jamais une conclusion.
 * Vide quand rien ne le signale.
 */
export function signauxAutomatiques(e: EntreeBruit): string[] {
  const signaux: string[] = [];
  const auto = entete(e.entetes, "auto-submitted");
  if (auto && !/^no$/i.test(auto.trim())) {
    signaux.push(
      "l'e-mail est marqué « émis automatiquement » par son en-tête",
    );
  }
  const locale = partieLocale(e.adresse);
  if (locale && EXPEDITEUR_SANS_REPONSE.some((re) => re.test(locale))) {
    signaux.push(`l'expéditeur ne lit pas les réponses (${locale}@…)`);
  }
  const objet = (e.objet ?? "").trim();
  if (objet && OBJET_AUTOMATIQUE.some((re) => re.test(objet))) {
    signaux.push("l'objet est celui d'un accusé ou d'une réponse automatique");
  }
  return signaux;
}
