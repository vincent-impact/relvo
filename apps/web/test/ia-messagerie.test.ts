import { describe, expect, it } from "vitest";
import { MESSAGERIE } from "@/server/ia/config";
import {
  ancreDeLaSalve,
  estDernierDeLaSalve,
  peutFaireTaire,
} from "@/server/ia/pipeline/messagerie-regles";
import { estHistorique } from "@/server/ia/pipeline/rattrapage-regles";
import { deciderTri } from "@/server/ia/pipeline/decision";
import type { SortieTri } from "@/server/ia/schemas";

// LE TRI DE LA MESSAGERIE DIRECTE EST TENU PAR UN TEST SUR SES RÈGLES PURES
// (M7 tranche 11, A8) : la salve (le tri ne se joue que sur le dernier
// entrant), l'ancre (le plus ancien orphelin dans la fenêtre, jamais au-delà),
// ce qui fait taire par canal, l'historique par la date de connexion du canal
// — et la décision du tri, inchangée sur l'e-mail.

const T = (iso: string) => new Date(iso);

describe("messagerie — la salve", () => {
  it("le tri ne se joue que si le déclencheur est encore le dernier entrant ; sinon il s'efface", () => {
    expect(
      estDernierDeLaSalve({ declencheurId: "m3", dernierEntrantId: "m3" }),
    ).toBe(true);
    expect(
      estDernierDeLaSalve({ declencheurId: "m1", dernierEntrantId: "m3" }),
    ).toBe(false);
    expect(
      estDernierDeLaSalve({ declencheurId: "m1", dernierEntrantId: null }),
    ).toBe(false);
    // Quarante-cinq secondes : le temps qu'une salve WhatsApp arrive.
    expect(MESSAGERIE.attenteSalveMs).toBe(45_000);
  });
});

describe("messagerie — l'ancre de l'écoute", () => {
  const fenetre = 2 * 60 * 60 * 1000;
  const declencheur = { id: "m3", recuLe: "2026-10-20T14:03:10Z" };

  it("est le plus ancien message orphelin de la salve, dans la fenêtre", () => {
    const messages = [
      { id: "m1", recuLe: "2026-10-20T14:02:00Z", orphelin: true },
      { id: "m2", recuLe: "2026-10-20T14:02:40Z", orphelin: true },
      { id: "m3", recuLe: "2026-10-20T14:03:10Z", orphelin: true },
    ];
    expect(ancreDeLaSalve(messages, declencheur, fenetre)).toBe("m1");
    expect(MESSAGERIE.fenetreSalveMs).toBe(fenetre);
  });

  it("n'emporte jamais un bavardage plus vieux que la fenêtre, ni un message déjà dans une affaire", () => {
    const messages = [
      // Il y a dix jours : le tri l'avait laissé sans affaire, il y reste.
      { id: "m0", recuLe: "2026-10-10T09:00:00Z", orphelin: true },
      // Juste à la limite de la fenêtre : exclu (strictement plus de deux heures).
      { id: "m0b", recuLe: "2026-10-20T12:03:10Z", orphelin: true },
      // Dans la fenêtre, mais déjà emporté par une affaire validée depuis.
      { id: "m1", recuLe: "2026-10-20T13:00:00Z", orphelin: false },
      { id: "m2", recuLe: "2026-10-20T14:02:40Z", orphelin: true },
      { id: "m3", recuLe: "2026-10-20T14:03:10Z", orphelin: true },
    ];
    expect(ancreDeLaSalve(messages, declencheur, fenetre)).toBe("m2");
  });

  it("retombe sur le déclencheur quand rien d'autre n'est dans la fenêtre, ou que les dates sont illisibles", () => {
    expect(
      ancreDeLaSalve(
        [{ id: "m0", recuLe: "2026-10-01T09:00:00Z", orphelin: true }],
        declencheur,
        fenetre,
      ),
    ).toBe("m3");
    expect(ancreDeLaSalve([], declencheur, fenetre)).toBe("m3");
    expect(
      ancreDeLaSalve(
        [{ id: "m1", recuLe: "2026-10-20T14:02:00Z", orphelin: true }],
        { id: "m3", recuLe: "pas une date" },
        fenetre,
      ),
    ).toBe("m3");
    // Un message daté APRÈS le déclencheur (horloge du fournisseur) n'est pas l'ancre.
    expect(
      ancreDeLaSalve(
        [{ id: "m4", recuLe: "2026-10-20T14:05:00Z", orphelin: true }],
        declencheur,
        fenetre,
      ),
    ).toBe("m3");
  });
});

describe("messagerie — ce qui fait taire, par canal", () => {
  it("sur l'e-mail, un « rien à faire » sûr fait taire quelle que soit la nature", () => {
    for (const nature of [
      "professionnel",
      "publicite",
      "automatique",
      "personnel",
    ] as const) {
      expect(
        peutFaireTaire({ canal: "email", nature, confiance: "haute" }),
      ).toBe(true);
    }
    expect(
      peutFaireTaire({
        canal: "email",
        nature: "publicite",
        confiance: "moyenne",
      }),
    ).toBe(false);
  });

  it("sur WhatsApp, seules la publicité et l'automatique mettent en sourdine ; un « merci » professionnel ou personnel laisse le fil vivant", () => {
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: "publicite",
        confiance: "haute",
      }),
    ).toBe(true);
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: "automatique",
        confiance: "haute",
      }),
    ).toBe(true);
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: "professionnel",
        confiance: "haute",
      }),
    ).toBe(false);
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: "personnel",
        confiance: "haute",
      }),
    ).toBe(false);
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: "publicite",
        confiance: "basse",
      }),
    ).toBe(false);
  });
});

describe("messagerie — l'historique par la date de connexion du canal", () => {
  it("un message daté d'avant la connexion du numéro est de l'historique rejoué ; daté d'après, c'est du courrier vivant", () => {
    const connecteLe = T("2026-10-20T10:00:00Z");
    expect(estHistorique("2026-10-19T18:00:00Z", connecteLe)).toBe(true);
    expect(estHistorique("2026-10-20T10:00:00Z", connecteLe)).toBe(false);
    expect(estHistorique("2026-10-20T10:00:30Z", connecteLe)).toBe(false);
  });
});

describe("messagerie — la décision du tri ne change pas sur l'e-mail", () => {
  const rienAFaire: SortieTri = {
    action: "rien_a_faire",
    nature: "professionnel",
    confiance: "haute",
    raison: "Un remerciement, rien à faire.",
    domaine: null,
    domaine_propose: null,
    sujet_existant: null,
    titre: null,
    priorite: "normal",
  };

  it("« rien à faire » professionnel en confiance haute reste une décision d'ignorer ; c'est le canal, après, qui dit si elle s'applique", () => {
    const decision = deciderTri(rienAFaire);
    expect(decision.type).toBe("ignorer");
    expect(
      peutFaireTaire({
        canal: "email",
        nature: rienAFaire.nature,
        confiance: rienAFaire.confiance,
      }),
    ).toBe(true);
    expect(
      peutFaireTaire({
        canal: "whatsapp",
        nature: rienAFaire.nature,
        confiance: rienAFaire.confiance,
      }),
    ).toBe(false);
  });
});
