import { describe, expect, it } from "vitest";
import { blocExpediteur } from "@/server/ia/contexte/couches";
import type { ExpediteurContexte } from "@/server/ia/contexte";
import {
  deciderParExpediteur,
  FENETRE_ATTENTE_JOURS,
  SEUIL_SOURCE_ECARTEE,
} from "@/server/ia/pipeline/expediteur";

// CE QUE L'EXPÉDITEUR DÉCIDE SANS APPEL (05 §9.5, §1.2) : une source déjà
// écartée se tait, un contact dont le seul sujet ouvert attend sa réponse est
// rattaché. Tout le reste va au modèle, avec le profil sous les yeux. Le seuil
// et la fenêtre sont UN endroit, testé.

const maintenant = new Date("2026-09-15T10:00:00Z");
const ilYA = (jours: number) =>
  new Date(maintenant.getTime() - jours * 86_400_000).toISOString();

const inconnu: ExpediteurContexte = {
  adresse: "promo@grossiste.fr",
  connu: false,
  nom: null,
  entreprise: null,
  role: null,
  sujetsParSesFils: 0,
  sujetsValides: 0,
  domaineHabituel: null,
  antecedentsTri: [],
  sujetsEnCours: [],
};

const karim: ExpediteurContexte = {
  adresse: "karim@sogood.fr",
  connu: true,
  nom: "Karim Benali",
  entreprise: "SoGood Distribution",
  role: "supplier",
  sujetsParSesFils: 4,
  sujetsValides: 3,
  domaineHabituel: "Fournisseurs",
  antecedentsTri: [],
  sujetsEnCours: [
    {
      reference: "SUB-0142",
      titre: "Rupture sauce blanche",
      enAttente: true,
      derniereActiviteLe: ilYA(2),
    },
  ],
};

describe("l'expéditeur décide sans appel", () => {
  it("une source écartée plusieurs fois pour la même raison se tait, à partir du seuil", () => {
    expect(SEUIL_SOURCE_ECARTEE).toBe(3);
    const deuxFois = {
      ...inconnu,
      antecedentsTri: [{ raison: "advertising", nombre: 2 }],
    };
    expect(deciderParExpediteur(deuxFois, maintenant)).toBeNull();
    expect(
      deciderParExpediteur(
        { ...inconnu, antecedentsTri: [{ raison: "advertising", nombre: 3 }] },
        maintenant,
      ),
    ).toEqual({ type: "ignorer", raison: "advertising", nombre: 3 });
    // Trois raisons différentes ne font pas une source à écarter ; « pas mon
    // rôle » non plus, seul l'utilisateur la connaît.
    expect(
      deciderParExpediteur(
        {
          ...inconnu,
          antecedentsTri: [
            { raison: "advertising", nombre: 1 },
            { raison: "automatic", nombre: 1 },
            { raison: "personal", nombre: 1 },
          ],
        },
        maintenant,
      ),
    ).toBeNull();
    expect(
      deciderParExpediteur(
        { ...inconnu, antecedentsTri: [{ raison: "not_my_role", nombre: 5 }] },
        maintenant,
      ),
    ).toBeNull();
  });

  it("un contact connu dont le SEUL sujet ouvert attend sa réponse est rattaché", () => {
    expect(deciderParExpediteur(karim, maintenant)).toEqual({
      type: "rattacher",
      reference: "SUB-0142",
      titre: "Rupture sauce blanche",
    });
  });

  it("mais pas s'il n'attend rien, s'il est trop ancien, s'il y en a deux, ou si l'adresse est inconnue", () => {
    const [s] = karim.sujetsEnCours;
    expect(
      deciderParExpediteur(
        { ...karim, sujetsEnCours: [{ ...s, enAttente: false }] },
        maintenant,
      ),
    ).toBeNull();
    expect(
      deciderParExpediteur(
        {
          ...karim,
          sujetsEnCours: [
            { ...s, derniereActiviteLe: ilYA(FENETRE_ATTENTE_JOURS + 1) },
          ],
        },
        maintenant,
      ),
    ).toBeNull();
    expect(
      deciderParExpediteur(
        {
          ...karim,
          sujetsEnCours: [s, { ...s, reference: "SUB-0150", enAttente: false }],
        },
        maintenant,
      ),
    ).toBeNull();
    expect(
      deciderParExpediteur({ ...karim, connu: false }, maintenant),
    ).toBeNull();
  });

  it("le bloc de contexte dit qui écrit, ce que ses fils ont produit, ce qu'on en a écarté — et rien quand on ne sait rien", () => {
    expect(blocExpediteur(inconnu)).toEqual([]);
    const bloc = blocExpediteur(karim).join("\n");
    expect(bloc).toContain(
      "Karim Benali (SoGood Distribution), contact connu, fournisseur.",
    );
    expect(bloc).toContain(
      "Ses fils ont ouvert 4 sujets (3 validés), domaine habituel Fournisseurs.",
    );
    expect(bloc).toContain("SUB-0142 (en attente de sa réponse)");
    expect(
      blocExpediteur({
        ...inconnu,
        antecedentsTri: [{ raison: "advertising", nombre: 2 }],
      }).join("\n"),
    ).toContain(
      "Adresse inconnue du carnet de contacts.\nDéjà ignoré : 2 fois pour publicité.",
    );
  });
});
