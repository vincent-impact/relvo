import { describe, expect, it } from "vitest";
import { detecterBruitDeterministe } from "@/server/ia/pipeline/bruit";

// LE FILTRE DÉTERMINISTE DU BRUIT (M7 tranche 4, 05 §9.5) : ce qui ne
// sollicite personne n'appelle pas le modèle. Et surtout ce qu'il LAISSE
// PASSER — un vrai message étiqueté « automatique » coûte plus cher qu'un
// appel de tri.

const base = {
  adresse: "karim@sogood.fr",
  nom: "Karim Benali",
  objet: "Rupture sauce blanche",
  contenu:
    "Bonjour, la sauce blanche est en rupture cette semaine. On remplace par la SB-210 ?\nKarim",
};

describe("filtre déterministe du bruit", () => {
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

  it("reconnaît un expéditeur sans réponse possible", () => {
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
      const v = detecterBruitDeterministe({ ...base, adresse });
      expect(v?.categorie, adresse).toBe("automatic");
      expect(v?.regle, adresse).toBe("expediteur-sans-reponse");
    }
  });

  it("ne confond pas « info@ » ou « contact@ » avec un automate", () => {
    expect(
      detecterBruitDeterministe({ ...base, adresse: "info@packplus.fr" }),
    ).toBeNull();
    expect(
      detecterBruitDeterministe({ ...base, adresse: "contact@climapro.fr" }),
    ).toBeNull();
  });

  it("reconnaît un accusé ou une réponse automatique à l'objet", () => {
    for (const objet of [
      "Réponse automatique : Rupture sauce blanche",
      "Automatic reply: Devis",
      "Out of office",
      "Accusé de réception de votre demande",
      "Delivery Status Notification (Failure)",
      "Échec de la remise",
    ]) {
      const v = detecterBruitDeterministe({ ...base, objet });
      expect(v?.categorie, objet).toBe("automatic");
      expect(v?.regle, objet).toBe("objet-automatique");
    }
  });

  it("reconnaît un envoi en masse par son lien de désabonnement en fin de message", () => {
    const promo = `${"Nos produits frais à prix cassés cette semaine. ".repeat(12)}\n\nVoir les offres : https://promo.exemple.fr/semaine\n\n${"Conditions en magasin. ".repeat(4)}\nPour ne plus recevoir nos e-mails, cliquez ici : https://promo.exemple.fr/unsubscribe`;
    const v = detecterBruitDeterministe({
      ...base,
      adresse: "offres@grossiste.fr",
      contenu: promo,
    });
    expect(v?.categorie).toBe("advertising");
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
      categorie: "advertising",
      regle: "en-tete-desabonnement",
    });
    expect(
      detecterBruitDeterministe({
        ...base,
        entetes: { "auto-submitted": "auto-replied" },
      }),
    ).toMatchObject({
      categorie: "automatic",
      regle: "en-tete-auto-submitted",
    });
    expect(
      detecterBruitDeterministe({
        ...base,
        entetes: { "auto-submitted": "no" },
      }),
    ).toBeNull();
    expect(
      detecterBruitDeterministe({ ...base, entetes: { precedence: "bulk" } }),
    ).toMatchObject({ categorie: "advertising", regle: "en-tete-precedence" });
  });
});
