import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chiffrementConfigure,
  chiffrer,
  dechiffrer,
} from "@/server/gmail/chiffrement";
import { lireEtat } from "@/server/gmail/etat";
import {
  donneesDepuisJetons,
  jetonsDepuisDonnees,
} from "@/server/gmail/jetons";
import {
  PERIMETRES,
  perimetresDe,
  perimetresManquants,
  urlDeConsentement,
} from "@/server/gmail/oauth";
import { pageDeRetour } from "@/server/courrier/retour";

// LA CONNEXION GMAIL (M24.2), sans réseau : les jetons se chiffrent et se
// relisent, une altération se refuse, l'URL du consentement demande ce qu'il
// faut et rien d'autre, l'état du départ se relit, la page de retour dit le
// résultat.

const CLE = Buffer.alloc(32, 7).toString("base64");

describe("chiffrement", () => {
  beforeEach(() => {
    process.env.RELVO_CHIFFREMENT_CLE = CLE;
  });
  afterEach(() => {
    delete process.env.RELVO_CHIFFREMENT_CLE;
  });

  it("chiffre et relit, jamais deux fois la même chaîne, et refuse l'altération", () => {
    const a = chiffrer("1//0g-rafraichissement");
    const b = chiffrer("1//0g-rafraichissement");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(a).not.toContain("rafraichissement");
    expect(dechiffrer(a)).toBe("1//0g-rafraichissement");
    const [v, iv, tag, texte] = a.split(".");
    const altere = [v, iv, tag, texte!.slice(0, -2) + "AA"].join(".");
    expect(() => dechiffrer(altere)).toThrow();
    expect(() => dechiffrer("n'importe quoi")).toThrow(/forme inconnue/);
  });

  it("dit clairement quand la clé manque ou n'a pas la bonne taille", () => {
    delete process.env.RELVO_CHIFFREMENT_CLE;
    expect(chiffrementConfigure()).toBe(false);
    expect(() => chiffrer("x")).toThrow(/RELVO_CHIFFREMENT_CLE manque/);
    process.env.RELVO_CHIFFREMENT_CLE = Buffer.alloc(16).toString("base64");
    expect(chiffrementConfigure()).toBe(false);
    expect(() => chiffrer("x")).toThrow(/32 octets/);
    process.env.RELVO_CHIFFREMENT_CLE = CLE;
    expect(chiffrementConfigure()).toBe(true);
  });

  it("les données du canal portent les jetons chiffrés, et gardent le reste à la reconnexion", () => {
    const jetons = {
      acces: "ya29.acces",
      rafraichissement: "1//0g",
      expireA: new Date("2026-10-28T10:00:00.000Z"),
      perimetres: [...PERIMETRES],
    };
    const d = donneesDepuisJetons(jetons, { historyId: "4242" });
    expect(d.historyId).toBe("4242");
    expect(JSON.stringify(d)).not.toContain("ya29");
    expect(JSON.stringify(d)).not.toContain("1//0g");
    const relus = jetonsDepuisDonnees(d);
    expect(relus?.acces).toBe("ya29.acces");
    expect(relus?.rafraichissement).toBe("1//0g");
    expect(relus?.expireA.toISOString()).toBe("2026-10-28T10:00:00.000Z");
    expect(relus?.perimetres).toEqual([...PERIMETRES]);
    expect(jetonsDepuisDonnees(null)).toBeNull();
    expect(jetonsDepuisDonnees({ mailProvider: "GOOGLE" })).toBeNull();
  });
});

describe("le consentement", () => {
  beforeEach(() => {
    process.env.GMAIL_CLIENT_ID = "id-de-test";
    process.env.GMAIL_CLIENT_SECRET = "secret-de-test";
    process.env.AUTH_URL = "http://localhost:3100";
  });

  it("demande lecture, envoi et adresse — hors ligne, à chaque fois, sur l'adresse de retour déclarée", () => {
    const url = new URL(
      urlDeConsentement({ state: "nonce-1", loginHint: "moi@tastycrousty.fr" }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("id-de-test");
    expect(p.get("redirect_uri")).toBe(
      "http://localhost:3100/api/gmail/retour",
    );
    expect(p.get("scope")?.split(" ")).toEqual([...PERIMETRES]);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("state")).toBe("nonce-1");
    expect(p.get("login_hint")).toBe("moi@tastycrousty.fr");
    expect(p.get("scope")).not.toMatch(/modify|mail\.google\.com/);
  });

  it("voit les périmètres qu'on a décochés", () => {
    const accordes = perimetresDe(
      "https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(perimetresManquants(accordes)).toEqual([
      "https://www.googleapis.com/auth/gmail.send",
    ]);
    expect(perimetresManquants([...PERIMETRES])).toEqual([]);
    expect(perimetresDe(undefined)).toEqual([]);
  });

  it("relit l'état d'un départ, et rien d'autre", () => {
    expect(
      lireEtat(
        JSON.stringify({
          nonce: "n",
          channelId: "c",
          retour: "relvo",
          adresse: "moi@x.fr",
        }),
      ),
    ).toEqual({
      nonce: "n",
      channelId: "c",
      retour: "relvo",
      adresse: "moi@x.fr",
    });
    expect(lireEtat(JSON.stringify({ nonce: "n", channelId: "c" }))).toBeNull();
    expect(
      lireEtat(
        JSON.stringify({ nonce: "n", channelId: "c", retour: "ailleurs" }),
      ),
    ).toBeNull();
    expect(lireEtat("{pas du json")).toBeNull();
  });

  it("la page de retour dit le résultat, d'où qu'on soit parti", () => {
    expect(pageDeRetour("canaux", { connected: true })).toBe(
      "/canaux?connected=1",
    );
    expect(pageDeRetour("relvo", { connected: true })).toBe(
      "/relvo?from=%2F&connected=1",
    );
    expect(pageDeRetour("canaux", { erreur: "perimetres" })).toBe(
      "/canaux?erreur=perimetres",
    );
  });
});
