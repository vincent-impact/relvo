import { describe, expect, it } from "vitest";
import {
  PLAFOND_DECISIONS,
  PLAFOND_OPTIONS,
  PLAFOND_QUESTIONS,
  PLAFOND_TACHES,
  PLAFOND_SOURCES,
  resoudreProvenance,
  retenirDates,
  retenirProposition,
  retenirSources,
  type CadreRetenue,
} from "@/server/ia/pipeline/proposition";
import type { SortieStructuration } from "@/server/ia/schemas";

// LA RETENUE DE LA PROPOSITION (M7 tranche 5, 05 §2, §9.3, §10.4) : ce que
// la structuration écrit est borné, conforme aux dates du modèle de données,
// résolu contre ce que le modèle a lu, et pris dans le registre. Tout le
// reste est écarté — et dit.

const cadre: CadreRetenue = {
  registre: ["retard-livraison", "contrat"],
  precedents: [
    { reference: "SUB-0042", titre: "Ouverture magasin Béziers" },
    { reference: "SUB-0050", titre: "Rupture sauce blanche — avoir" },
  ],
  instructions: ["Remplacements", "Ton des réponses"],
  documents: ["Contrat SoGood.pdf"],
  domaineConnu: false,
  domaineProposeExistant: null,
  contact: "auto",
};

const sortie: SortieStructuration = {
  situation: {
    ou_on_en_est: " Le fournisseur propose la SB-210. ",
    prochaine_etape: "Répondre.",
    attente: "",
    echeance: "2026-09-11",
  },
  resume: "Rupture annoncée, remplacement proposé.",
  taches: [
    {
      titre: "Valider le remplacement",
      type: "decision",
      date: "2026-09-11",
      heure: null,
      date_fin: null,
      heure_fin: null,
      raison: "Retour demandé avant jeudi.",
      provenance: null,
      decisions: [],
    },
    {
      titre: "Demander le bon de livraison",
      type: "check",
      date: "2026-09-11",
      heure: "14:00",
      date_fin: null,
      heure_fin: "16:00",
      raison: "L'instruction l'exige.",
      provenance: "Remplacements",
      decisions: [],
    },
    {
      titre: "Appeler le magasin",
      type: "call",
      date: null,
      heure: "09:00",
      date_fin: null,
      heure_fin: null,
      raison: "Comme la dernière fois.",
      provenance: "d'après SUB-0050",
      decisions: [],
    },
  ],
  contact: {
    prenom: "Karim",
    nom: "Benali",
    entreprise: " SoGood ",
    role: "supplier",
    telephone: null,
    email: null,
  },
  etiquettes: ["Retard livraison", "urgent"],
  etiquette_nouvelle: "remplacement",
  questions: [
    { portee: "contact", texte: "SoGood est-il le fournisseur principal ?" },
  ],
  domaine_propose: "Approvisionnement",
};

describe("les dates d'une tâche", () => {
  it("retire une heure ou une fin sans date, une fin avant le début, une heure de fin sans début", () => {
    expect(
      retenirDates({
        date: null,
        heure: "09:00",
        date_fin: null,
        heure_fin: null,
      }),
    ).toEqual({
      date: null,
      heure: null,
      dateFin: null,
      heureFin: null,
      retire: ["heure ou fin sans date"],
    });
    expect(
      retenirDates({
        date: "2026-09-12",
        heure: null,
        date_fin: "2026-09-10",
        heure_fin: "16:00",
      }),
    ).toEqual({
      date: "2026-09-12",
      heure: null,
      dateFin: null,
      heureFin: null,
      retire: [
        "date de fin avant le début",
        "heure de fin sans heure de début",
      ],
    });
  });

  it("garde une plage et un créneau valides, et replie une fin égale au début", () => {
    expect(
      retenirDates({
        date: "2026-09-12",
        heure: "14:00",
        date_fin: "2026-09-14",
        heure_fin: "10:00",
      }),
    ).toMatchObject({ dateFin: "2026-09-14", heureFin: "10:00", retire: [] });
    expect(
      retenirDates({
        date: "2026-09-12",
        heure: "14:00",
        date_fin: "2026-09-12",
        heure_fin: "13:00",
      }),
    ).toMatchObject({
      dateFin: null,
      heureFin: null,
      retire: ["heure de fin avant l'heure de début"],
    });
  });
});

describe("la provenance", () => {
  it("se résout contre les précédents, les instructions et les documents lus", () => {
    expect(resoudreProvenance("d'après SUB-0042", cadre)).toEqual({
      type: "precedent",
      reference: "SUB-0042",
      libelle: "Ouverture magasin Béziers",
    });
    expect(resoudreProvenance("instruction « remplacements »", cadre)).toEqual({
      type: "instruction",
      reference: null,
      libelle: "Remplacements",
    });
    expect(resoudreProvenance("Contrat SoGood.pdf", cadre)).toEqual({
      type: "document",
      reference: null,
      libelle: "Contrat SoGood.pdf",
    });
  });

  it("ne reconnaît jamais une référence que le modèle n'a pas lue", () => {
    expect(resoudreProvenance("SUB-9999", cadre)).toEqual({
      type: "autre",
      reference: null,
      libelle: "SUB-9999",
    });
    expect(resoudreProvenance("  ", cadre)).toBeNull();
    expect(resoudreProvenance(null, cadre)).toBeNull();
  });
});

describe("la retenue", () => {
  const r = retenirProposition(sortie, cadre);

  it("nettoie la situation et le résumé", () => {
    expect(r.situation).toEqual({
      ouOnEnEst: "Le fournisseur propose la SB-210.",
      prochaineEtape: "Répondre.",
      attente: null,
      echeance: "2026-09-11",
    });
    expect(r.resume).toBe("Rupture annoncée, remplacement proposé.");
  });

  it("garde les tâches avec leurs dates conformes et leur provenance résolue", () => {
    expect(r.taches.map((t) => t.titre)).toEqual([
      "Valider le remplacement",
      "Demander le bon de livraison",
      "Appeler le magasin",
    ]);
    expect(r.taches[1]).toMatchObject({
      heure: "14:00",
      heureFin: "16:00",
      provenance: { type: "instruction", libelle: "Remplacements" },
    });
    expect(r.taches[2]).toMatchObject({
      date: null,
      heure: null,
      provenance: { type: "precedent", reference: "SUB-0050" },
    });
    expect(r.ecarts).toContain("Appeler le magasin : heure ou fin sans date");
  });

  it("complète le contact, prend les étiquettes dans le registre, garde le reste pour le journal", () => {
    expect(r.contact).toEqual({
      prenom: "Karim",
      nom: "Benali",
      entreprise: "SoGood",
      role: "supplier",
      telephone: null,
      email: null,
    });
    expect(r.etiquettes).toEqual(["retard-livraison"]);
    expect(r.ecarts).toContain("étiquette hors registre : urgent");
    expect(r.etiquetteNouvelle).toBe("remplacement");
    expect(r.questions).toHaveLength(1);
    expect(r.domainePropose).toBe("Approvisionnement");
  });

  it("écarte les tâches vides ou en double, et plafonne", () => {
    const beaucoup = retenirProposition(
      {
        ...sortie,
        taches: [
          { ...sortie.taches[0]!, titre: "  " },
          ...Array.from({ length: PLAFOND_TACHES + 2 }, (_, i) => ({
            ...sortie.taches[0]!,
            titre: `Tâche ${i}`,
          })),
          { ...sortie.taches[0]!, titre: "tâche 0" },
        ],
        questions: Array.from({ length: PLAFOND_QUESTIONS + 2 }, () => ({
          portee: "sujet" as const,
          texte: "?",
        })),
      },
      cadre,
    );
    expect(beaucoup.taches).toHaveLength(PLAFOND_TACHES);
    expect(beaucoup.ecarts).toContain("tâche sans titre");
    expect(beaucoup.ecarts).toContain("tâche en double : tâche 0");
    expect(beaucoup.ecarts.filter((e) => e.startsWith("plafond"))).toHaveLength(
      2,
    );
    expect(beaucoup.questions).toHaveLength(PLAFOND_QUESTIONS);
  });

  it("garde le téléphone et l'e-mail lus dans la signature — l'e-mail seulement s'il en a la forme", () => {
    const r = retenirProposition(
      {
        ...sortie,
        contact: {
          ...sortie.contact!,
          telephone: " 06 12 34 56 78 ",
          email: "sophie@maintenance-sud.fr",
        },
      },
      cadre,
    );
    expect(r.contact).toMatchObject({
      telephone: "06 12 34 56 78",
      email: "sophie@maintenance-sud.fr",
    });
    const faux = retenirProposition(
      { ...sortie, contact: { ...sortie.contact!, email: "voir signature" } },
      cadre,
    );
    expect(faux.contact?.email).toBeNull();
  });

  it("garde les décisions d'une tâche qui se répond — questions bornées, options distinctes de deux à quatre — et rien sur les autres", () => {
    const decision = (question: string, options: string[]) => ({
      question,
      precision: " 480 € HT ",
      options,
    });
    const r = retenirProposition(
      {
        ...sortie,
        taches: [
          {
            ...sortie.taches[0]!,
            type: "reply",
            decisions: [
              decision("Lancer le remplacement ?", [
                "Oui, commandez",
                " oui, commandez ",
                "Non",
                "Plus tard",
                "Autre",
                "Encore",
              ]),
              decision("  ", ["a", "b"]),
              decision("Une seule option", ["Oui"]),
              ...Array.from({ length: PLAFOND_DECISIONS + 1 }, (_, i) =>
                decision(`Question ${i}`, ["a", "b"]),
              ),
            ],
          },
          {
            ...sortie.taches[1]!,
            type: "check",
            decisions: [decision("Sur une vérification ?", ["a", "b"])],
          },
        ],
      },
      cadre,
    );
    const [reply, check] = r.taches;
    expect(reply!.decisions).toHaveLength(PLAFOND_DECISIONS);
    expect(reply!.decisions[0]).toEqual({
      id: "d1",
      question: "Lancer le remplacement ?",
      precision: "480 € HT",
      options: ["Oui, commandez", "Non", "Plus tard", "Autre"],
    });
    expect(reply!.decisions.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
    expect(check!.decisions).toEqual([]);
    expect(r.ecarts).toContain(
      `Lancer le remplacement ? : plafond de ${PLAFOND_OPTIONS} options : Encore`,
    );
    expect(r.ecarts).toContain(
      "Valider le remplacement : décision sans question",
    );
    expect(r.ecarts).toContain("Une seule option : moins de deux options");
    expect(r.ecarts).toContain(
      "Demander le bon de livraison : décisions sur une tâche qui ne se répond pas",
    );
  });

  it("ne pousse ni contact vers un sujet sans contact, ni domaine proposé vers un sujet classé", () => {
    const groupe = retenirProposition(sortie, {
      ...cadre,
      contact: "aucun",
      domaineConnu: true,
    });
    expect(groupe.contact).toBeNull();
    expect(groupe.domainePropose).toBeNull();
    expect(groupe.ecarts).toContain(
      "contact proposé sur un sujet sans contact",
    );
    const dejaPropose = retenirProposition(sortie, {
      ...cadre,
      domaineProposeExistant: "Achats",
    });
    expect(dejaPropose.domainePropose).toBeNull();
  });

  it("une étiquette « nouvelle » déjà au registre est une étiquette du registre", () => {
    const r2 = retenirProposition(
      { ...sortie, etiquettes: [], etiquette_nouvelle: "Contrat" },
      cadre,
    );
    expect(r2.etiquettes).toEqual(["contrat"]);
    expect(r2.etiquetteNouvelle).toBeNull();
  });

  it("un message informatif ne produit aucune tâche, et c'est une sortie valide", () => {
    const rien = retenirProposition({ ...sortie, taches: [] }, cadre);
    expect(rien.taches).toEqual([]);
    expect(rien.ecarts).not.toContain("tâche sans titre");
  });
});

// LES CITATIONS D'UN BROUILLON (M7.12, 05 §10.4) : résolues contre ce que le
// modèle a lu, et rien d'autre — une source que le cadre ne connaît pas n'est
// pas une citation, c'est une invention.
describe("retenirSources — les citations d'un brouillon", () => {
  const cadre = {
    precedents: [{ reference: "SUB-0042", titre: "Ouverture magasin Béziers" }],
    instructions: ["Procédure fournisseurs v3", "Délais de paiement"],
    documents: ["Tarifs SoGood 2026.pdf"],
  };

  it("résout instruction, document et précédent, sans doublon, à la casse et aux accents près", () => {
    const ecarts: string[] = [];
    const sources = retenirSources(
      [
        "procedure fournisseurs V3",
        "Tarifs SoGood 2026.pdf",
        "Procédure fournisseurs v3",
        "d'après SUB-0042",
      ],
      cadre,
      ecarts,
    );
    expect(sources.map((s) => s.type)).toEqual([
      "instruction",
      "document",
      "precedent",
    ]);
    expect(sources[0].libelle).toBe("Procédure fournisseurs v3");
    expect(sources[2]).toEqual({
      type: "precedent",
      reference: "SUB-0042",
      libelle: "Ouverture magasin Béziers",
    });
    expect(ecarts).toEqual([]);
  });

  it("écarte une source inconnue du cadre, et le dit", () => {
    const ecarts: string[] = [];
    const sources = retenirSources(
      ["Le message du fournisseur", "SUB-9999", ""],
      cadre,
      ecarts,
    );
    expect(sources).toEqual([]);
    expect(ecarts).toHaveLength(2);
    expect(ecarts[0]).toContain("source inconnue du cadre");
  });

  it("plafonne le nombre de sources", () => {
    const ecarts: string[] = [];
    const large = {
      ...cadre,
      instructions: Array.from({ length: 6 }, (_, i) => `Instruction ${i}`),
    };
    const sources = retenirSources(large.instructions, large, ecarts);
    expect(sources).toHaveLength(PLAFOND_SOURCES);
    expect(ecarts.some((e) => e.includes("plafond"))).toBe(true);
  });
});
