import { describe, expect, it } from "vitest";
import {
  PLAFOND_TACHES_RELECTURE,
  retenirRelecture,
  type CadreRelecture,
} from "@/server/ia/pipeline/proposition";
import type { SortieRelecture } from "@/server/ia/schemas";

// LA RETENUE DE LA RELECTURE (M7 tranche 6, 05 §5.3–§5.5, §8.4–§8.5) : ce
// qu'un message entrant a le droit de changer est borné ici, en un seul
// endroit. Relvo ne ferme jamais : il suggère, et seulement sans tâche
// ouverte ; il retire sa suggestion dès qu'il ne conclut plus à la fin ; il
// ne pose « En attente » qu'en nommant ce qu'on attend, et ne le lève jamais
// — la mécanique l'a déjà fait.

const cadre: CadreRelecture = {
  registre: ["retard-livraison", "contrat"],
  precedents: [
    { reference: "SUB-0050", titre: "Rupture sauce blanche — avoir" },
  ],
  instructions: ["Remplacements"],
  documents: [],
  tachesOuvertes: [],
  resolutionSuggeree: false,
};

const sortie: SortieRelecture = {
  situation: {
    ou_on_en_est: "Le fournisseur confirme la livraison de la SB-210 jeudi.",
    prochaine_etape: "Réceptionner la livraison.",
    attente: "Livraison SoGood jeudi",
    echeance: "2026-09-17",
  },
  resume: "Rupture de sauce blanche, remplacée par la SB-210.",
  taches: [],
  etiquettes: ["Retard livraison", "hors-registre"],
  priorite: "normal",
  en_attente: true,
  termine: false,
  raison: "Le fournisseur a confirmé la livraison.",
};

const tache = (titre: string): SortieRelecture["taches"][number] => ({
  titre,
  type: "check",
  date: null,
  heure: null,
  date_fin: null,
  heure_fin: null,
  raison: "Parce que.",
  provenance: null,
});

describe("retenirRelecture", () => {
  it("pose « En attente » quand le modèle le dit ET nomme ce qu'on attend ; jamais sans objet", () => {
    expect(retenirRelecture(sortie, cadre)).toMatchObject({
      enAttente: true,
      resolution: "garder",
      etiquettes: ["retard-livraison"],
      raison: "Le fournisseur a confirmé la livraison.",
      ecarts: ["étiquette hors registre : hors-registre"],
    });
    const sansObjet = retenirRelecture(
      { ...sortie, situation: { ...sortie.situation, attente: " " } },
      cadre,
    );
    expect(sansObjet.enAttente).toBeNull();
    expect(sansObjet.situation.attente).toBeNull();
    expect(sansObjet.ecarts).toContain(
      "en attente sans dire de qui : marqueur non posé",
    );
    expect(
      retenirRelecture({ ...sortie, en_attente: false }, cadre).enAttente,
    ).toBeNull();
  });

  it("suggère la clôture seulement sans tâche ouverte — ni ancienne, ni retenue à l'instant", () => {
    const termine = { ...sortie, termine: true, en_attente: false };
    expect(retenirRelecture(termine, cadre).resolution).toBe("suggerer");
    const avecAncienne = retenirRelecture(termine, {
      ...cadre,
      tachesOuvertes: ["Vérifier l'avoir"],
    });
    expect(avecAncienne.resolution).toBe("garder");
    expect(avecAncienne.ecarts).toContain(
      "terminé avec des tâches ouvertes : clôture non suggérée",
    );
    const avecNouvelle = retenirRelecture(
      { ...termine, taches: [tache("Réceptionner la livraison")] },
      cadre,
    );
    expect(avecNouvelle.resolution).toBe("garder");
    expect(avecNouvelle.taches).toHaveLength(1);
  });

  it("retire une suggestion en cours dès que le modèle ne conclut plus à la fin ; re-suggère sinon", () => {
    const suggeree = { ...cadre, resolutionSuggeree: true };
    expect(retenirRelecture(sortie, suggeree).resolution).toBe("revoquer");
    expect(
      retenirRelecture({ ...sortie, termine: true }, suggeree).resolution,
    ).toBe("suggerer");
    expect(
      retenirRelecture(
        { ...sortie, termine: true, taches: [tache("Payer")] },
        suggeree,
      ).resolution,
    ).toBe("revoquer");
  });

  it("écarte une tâche qui répète une tâche déjà ouverte, insensible à la casse et aux accents, et plafonne", () => {
    const r = retenirRelecture(
      {
        ...sortie,
        taches: [
          tache("Vérifier l'avoir"),
          tache("Réceptionner la livraison"),
          tache("Réceptionner la livraison"),
          tache("A"),
          tache("B"),
          tache("C"),
          tache("D"),
        ],
      },
      { ...cadre, tachesOuvertes: ["verifier l avoir"] },
    );
    expect(r.etiquettes).toEqual(["retard-livraison"]);
    expect(r.taches.map((t) => t.titre)).toEqual([
      "Réceptionner la livraison",
      "A",
      "B",
      "C",
    ]);
    expect(r.taches).toHaveLength(PLAFOND_TACHES_RELECTURE);
    expect(r.ecarts).toEqual([
      "tâche en double : Vérifier l'avoir",
      "tâche en double : Réceptionner la livraison",
      `plafond de ${PLAFOND_TACHES_RELECTURE} tâches : D`,
      "étiquette hors registre : hors-registre",
    ]);
  });

  it("garde la priorité telle que rendue et résout la provenance contre ce que le modèle a lu", () => {
    const r = retenirRelecture(
      {
        ...sortie,
        priorite: "urgent",
        taches: [
          { ...tache("Demander le bon"), provenance: "d'après SUB-0050" },
          { ...tache("Prévenir"), provenance: "Remplacements" },
        ],
      },
      cadre,
    );
    expect(r.priorite).toBe("urgent");
    expect(r.taches[0].provenance).toEqual({
      type: "precedent",
      reference: "SUB-0050",
      libelle: "Rupture sauce blanche — avoir",
    });
    expect(r.taches[1].provenance).toEqual({
      type: "instruction",
      reference: null,
      libelle: "Remplacements",
    });
  });
});
