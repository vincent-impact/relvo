import { describe, expect, it } from "vitest";
import { MESSAGERIE } from "@/server/ia/config";
import {
  ancreDeLaSalve,
  assezDAvisPourIgnorer,
  autourDeLaMention,
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
    expect(MESSAGERIE.attenteSalveMs).toBe(60_000);
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

  it("n'emporte jamais un bavardage plus vieux que la fenêtre, ni un message déjà dans un sujet", () => {
    const messages = [
      // Il y a dix jours : le tri l'avait laissé sans sujet, il y reste.
      { id: "m0", recuLe: "2026-10-10T09:00:00Z", orphelin: true },
      // Juste à la limite de la fenêtre : exclu (strictement plus de deux heures).
      { id: "m0b", recuLe: "2026-10-20T12:03:10Z", orphelin: true },
      // Dans la fenêtre, mais déjà emporté par un sujet validé depuis.
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

  it("sur WhatsApp, seuls la publicité, l'automatique et l'indésirable mettent en sourdine ; un « merci » professionnel ou personnel laisse le fil vivant", () => {
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
        nature: "indesirable",
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

describe("messagerie — il faut une série d'avis pour ignorer un interlocuteur (M25.11)", () => {
  it("le seuil est de trois « rien à faire » sûrs d'affilée", () => {
    expect(MESSAGERIE.verdictsAvantIgnorance).toBe(3);
  });

  it("sur WhatsApp, ni la première ni la deuxième salve n'ignorent ; la troisième, oui", () => {
    expect(assezDAvisPourIgnorer({ canal: "whatsapp", serie: 1 })).toBe(false);
    expect(assezDAvisPourIgnorer({ canal: "whatsapp", serie: 2 })).toBe(false);
    expect(assezDAvisPourIgnorer({ canal: "whatsapp", serie: 3 })).toBe(true);
    expect(assezDAvisPourIgnorer({ canal: "whatsapp", serie: 7 })).toBe(true);
  });

  it("sur l'e-mail, un seul avis sûr suffit : c'est un fil qu'on écarte, pas une personne", () => {
    expect(assezDAvisPourIgnorer({ canal: "email", serie: 1 })).toBe(true);
    expect(assezDAvisPourIgnorer({ canal: "email", serie: 0 })).toBe(true);
  });
});

describe("un groupe lu sur une mention (M29.4)", () => {
  const fil = Array.from({ length: 12 }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    recuLe: new Date(Date.UTC(2026, 10, 24, 9, i)).toISOString(),
    orphelin: true,
  }));

  it("la fenêtre : ce qui précède la mention, la mention, et ce que son auteur ajoute", () => {
    const fenetre = autourDeLaMention([...fil].reverse(), "g08");
    expect(fenetre.map((m) => m.id)).toEqual([
      "g02",
      "g03",
      "g04",
      "g05",
      "g06",
      "g07",
      "g08",
      "g09",
      "g10",
    ]);
    // En début de fil, on prend ce qu'il y a ; une mention introuvable rend tout.
    expect(autourDeLaMention(fil, "g01").map((m) => m.id)).toEqual([
      "g00",
      "g01",
      "g02",
      "g03",
    ]);
    expect(autourDeLaMention(fil, "absent")).toHaveLength(12);
  });

  it("l'écoute s'ancre sur cette fenêtre, pas sur deux heures de conversation", () => {
    const mention = fil[8]!;
    expect(ancreDeLaSalve(fil, mention)).toBe("g00");
    expect(ancreDeLaSalve(autourDeLaMention(fil, mention.id), mention)).toBe(
      "g02",
    );
  });
});
