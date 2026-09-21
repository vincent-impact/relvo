import { describe, expect, it } from "vitest";
import {
  calendrierParis,
  debutDuJourParis,
  heureParis,
  horodatageParis,
  jourDecale,
  jourParis,
} from "../src/domain/temps";

// L'HEURE DE RELVO EST L'HEURE FRANÇAISE (PITFALLS #55). Ce test tient la
// frontière : heure d'été, heure d'hiver, les deux bascules de l'année, et le
// créneau du matin où le jour UTC n'est plus le jour français. Ces cas-là ne se
// vérifient pas à la lecture — ils se vérifient ici, ou jamais.

// Le bug d'origine : un message reçu à 19h31 à Paris, un e-mail « j'arrive dans
// 1h », un rendez-vous posé à 18h. Le modèle lisait l'horloge de Greenwich.
const SOIR_ETE = new Date("2026-09-21T17:31:00Z");

describe("l'heure française, l'été", () => {
  it("19h31 à Paris quand il est 17h31 à Greenwich", () => {
    expect(heureParis(SOIR_ETE)).toBe("19:31");
    expect(jourParis(SOIR_ETE)).toBe("2026-09-21");
    expect(horodatageParis(SOIR_ETE)).toBe("2026-09-21 19:31");
  });

  it("accepte aussi une chaîne ISO — c'est sous cette forme que le contexte porte les dates", () => {
    expect(horodatageParis("2026-09-21T17:31:00.000Z")).toBe(
      "2026-09-21 19:31",
    );
  });
});

describe("l'heure française, l'hiver", () => {
  it("le décalage passe à une heure", () => {
    const hiver = new Date("2026-12-21T17:31:00Z");
    expect(heureParis(hiver)).toBe("18:31");
    expect(calendrierParis(hiver)).toEqual({
      annee: 2026,
      mois: 12,
      jour: 21,
      heures: 18,
      minutes: 31,
    });
  });

  it("les deux bascules de 2026 : le dernier dimanche de mars et celui d'octobre", () => {
    // 29 mars 2026, 01:00 UTC : il est 02:00 à Paris, l'heure d'été commence.
    expect(heureParis(new Date("2026-03-29T00:59:00Z"))).toBe("01:59");
    expect(heureParis(new Date("2026-03-29T01:00:00Z"))).toBe("03:00");
    // 25 octobre 2026, 01:00 UTC : on repasse à l'heure d'hiver.
    expect(heureParis(new Date("2026-10-25T00:59:00Z"))).toBe("02:59");
    expect(heureParis(new Date("2026-10-25T01:00:00Z"))).toBe("02:00");
  });
});

describe("le jour civil français", () => {
  it("après minuit à Paris, le jour a changé — même si le jour UTC, lui, n'a pas bougé", () => {
    const nuit = new Date("2026-09-21T22:30:00Z"); // 00h30 le 22 à Paris
    expect(nuit.toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(jourParis(nuit)).toBe("2026-09-22");
    expect(debutDuJourParis(nuit).toISOString()).toBe(
      "2026-09-22T00:00:00.000Z",
    );
  });

  it("minuit pile n'est jamais « 24h »", () => {
    expect(heureParis(new Date("2026-09-21T22:00:00Z"))).toBe("00:00");
  });

  it("le début du jour est une DATE NUE, comparable aux échéances stockées", () => {
    const debut = debutDuJourParis(SOIR_ETE);
    expect(debut.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    // La veille et le lendemain, sur le calendrier français.
    expect(jourDecale(SOIR_ETE, -1).toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(jourDecale(SOIR_ETE, 1).toISOString()).toBe(
      "2026-09-22T00:00:00.000Z",
    );
  });

  it("un décalage de jours traverse une bascule d'heure sans glisser", () => {
    // Du 24 au 26 octobre 2026, avec le changement d'heure au milieu.
    const veille = new Date("2026-10-24T12:00:00Z");
    expect(jourDecale(veille, 1).toISOString()).toBe(
      "2026-10-25T00:00:00.000Z",
    );
    expect(jourDecale(veille, 2).toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
  });
});
