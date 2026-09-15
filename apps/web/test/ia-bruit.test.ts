import { describe, expect, it } from "vitest";
import {
  detecterBruitDeterministe,
  signauxAutomatiques,
} from "@/server/ia/pipeline/bruit";

// LE FILTRE DÉTERMINISTE DE LA PUBLICITÉ (M7 tranche 4, 05 §9.5) : un envoi
// en masse n'appelle pas le modèle. Les signaux d'AUTOMATE, eux, ne concluent
// plus — un accusé de réception est souvent le message qu'un sujet attendait —
// ils sont relevés pour le modèle. Et surtout ce que le filtre LAISSE PASSER :
// un vrai message mis en sourdine coûte plus cher qu'un appel de tri.

const base = {
  adresse: "karim@sogood.fr",
  nom: "Karim Benali",
  objet: "Rupture sauce blanche",
  contenu:
    "Bonjour, la sauce blanche est en rupture cette semaine. On remplace par la SB-210 ?\nKarim",
};

describe("filtre déterministe de la publicité", () => {
  it("laisse passer un message ordinaire", () => {
    expect(detecterBruitDeterministe(base)).toBeNull();
  });

  it("laisse passer un client qui demande à se désabonner en deux lignes", () => {
    expect(
      detecterBruitDeterministe({
        ...base,
        contenu:
          "Bonjour, je souhaite me désabonner de vos menus du midi. Merci.",
      }),
    ).toBeNull();
  });

  it("un expéditeur sans réponse possible ne conclut plus : il est signalé au modèle", () => {
    for (const adresse of [
      "noreply@banque.fr",
      "no-reply@uber.com",
      "ne-pas-repondre@impots.gouv.fr",
      "nepasrepondre@ameli.fr",
      "donotreply@stripe.com",
      "MAILER-DAEMON@mail.fr",
      "notifications@github.com",
      "newsletter@metro.fr",
    ]) {
      expect(
        detecterBruitDeterministe({ ...base, adresse }),
        adresse,
      ).toBeNull();
      expect(signauxAutomatiques({ ...base, adresse }), adresse).toHaveLength(
        1,
      );
    }
    expect(signauxAutomatiques(base)).toEqual([]);
  });

  it("ne confond pas « info@ » ou « contact@ » avec un automate", () => {
    expect(
      signauxAutomatiques({ ...base, adresse: "info@packplus.fr" }),
    ).toEqual([]);
    expect(
      signauxAutomatiques({ ...base, adresse: "contact@climapro.fr" }),
    ).toEqual([]);
  });

  it("un accusé ou une réponse automatique à l'objet est signalé, jamais conclu", () => {
    for (const objet of [
      "Réponse automatique : Rupture sauce blanche",
      "Automatic reply: Devis",
      "Out of office",
      "Accusé de réception de votre demande",
      "Delivery Status Notification (Failure)",
      "Échec de la remise",
    ]) {
      expect(detecterBruitDeterministe({ ...base, objet }), objet).toBeNull();
      expect(signauxAutomatiques({ ...base, objet })[0], objet).toContain(
        "accusé",
      );
    }
  });

  it("reconnaît un envoi en masse par son lien de désabonnement en fin de message", () => {
    const promo = `${"Nos produits frais à prix cassés cette semaine. ".repeat(12)}\n\nVoir les offres : https://promo.exemple.fr/semaine\n\n${"Conditions en magasin. ".repeat(4)}\nPour ne plus recevoir nos e-mails, cliquez ici : https://promo.exemple.fr/unsubscribe`;
    const v = detecterBruitDeterministe({
      ...base,
      adresse: "offres@grossiste.fr",
      contenu: promo,
    });
    expect(v?.nature).toBe("publicite");
    expect(v?.regle).toBe("lien-desabonnement");
  });

  it("exige un lien : une formule seule ne suffit pas", () => {
    const long = `${"Bonjour, voici le point hebdomadaire sur les livraisons. ".repeat(12)}\nPour ne plus recevoir ces messages, répondez à cet e-mail.`;
    expect(detecterBruitDeterministe({ ...base, contenu: long })).toBeNull();
  });

  it("lit les en-têtes quand ils existent, avant tout le reste", () => {
    expect(
      detecterBruitDeterministe({
        ...base,
        entetes: { "list-unsubscribe": "<https://x.fr/u>" },
      }),
    ).toMatchObject({
      nature: "publicite",
      regle: "en-tete-desabonnement",
    });
    expect(
      detecterBruitDeterministe({
        ...base,
        entetes: { "auto-submitted": "auto-replied" },
      }),
    ).toBeNull();
    expect(
      signauxAutomatiques({
        ...base,
        entetes: { "auto-submitted": "auto-replied" },
      }),
    ).toHaveLength(1);
    expect(
      signauxAutomatiques({ ...base, entetes: { "auto-submitted": "no" } }),
    ).toEqual([]);
    expect(
      detecterBruitDeterministe({ ...base, entetes: { precedence: "bulk" } }),
    ).toMatchObject({ nature: "publicite", regle: "en-tete-precedence" });
  });
});
