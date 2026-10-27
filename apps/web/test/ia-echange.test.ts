import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream, tool } from "ai";
import { z } from "zod";
import { chat, PLAFONDS } from "@/server/ia";
import {
  BUDGETS,
  contexteEchange,
  mesurerCouches,
  prefixeStable,
  type BriefCompte,
  type CompteContexte,
  type SujetContexte,
} from "@/server/ia/contexte";
import {
  BUDGET_PRODUIT,
  coucheProduit,
  coucheProduitEchange,
  estimerJetons,
  SOCLE_ECHANGE,
} from "@/server/ia/produit";
import {
  bornesPeriode,
  DEBUT_CONTEXTE,
  FIN_CONTEXTE,
  heureNue,
  injecterVolatil,
  lirePage,
  titreTaches,
  versCreateTaskInput,
} from "@/server/ia/echange/conversions";

// L'ÉCHANGE AVEC RELVO EST TENU PAR UN TEST (M10, tranche 1) — sans base, sans
// modèle : ce que le contexte d'un tour met où (le cache est un préfixe,
// PITFALLS.md #49), ce qu'un argument d'outil devient pour le domaine (l'heure
// française reste nue, #55), et ce que `chat()` garantit à un tour — l'outil
// est appelé avec ses arguments, et le plafond d'étapes tient.

const compte: CompteContexte = {
  dirigeant: "Mam's Crousty",
  entreprise: "Tasty Crousty",
  messageries: ["contact@tastycrousty.fr"],
  secteurs: ["food", "construction"],
  domaines: [
    { nom: "Fournisseurs", description: "Achats et livraisons" },
    { nom: "Général", description: null },
    { nom: "RH", description: "Personnel, plannings" },
  ],
  instructionsGenerales: Array.from({ length: 5 }, (_, i) => ({
    titre: `Instruction ${i}`,
    contenu:
      "Une consigne d'une centaine de caractères environ, répétée pour peser dans le budget. ".repeat(
        3,
      ),
  })),
  etiquettes: ["retard-livraison", "contrat", "recrutement"],
  preferencesObservees: "Garde les tâches de réponse.",
  sujetsOuverts: [],
};

const brief: BriefCompte = {
  sujetsOuverts: 12,
  sujetsUrgents: Array.from({ length: 8 }, (_, i) => ({
    reference: `SUB-${String(i + 1).padStart(4, "0")}`,
    titre: `Sujet urgent numéro ${i + 1} avec un titre de longueur ordinaire`,
  })),
  tachesDuJour: 3,
  tachesEnRetard: 2,
  conversationsATrier: 4,
  messagesRecusAujourdhui: 3,
  messagesRecus7j: 21,
};

const sujet: SujetContexte = {
  reference: "SUB-0142",
  titre: "Retard livraison sauce blanche",
  domaine: "Fournisseurs",
  etiquettes: ["retard-livraison"],
  statut: "ouvert",
  priorite: "urgent",
  enAttente: true,
  ouvertLe: "2026-10-10T08:00:00.000Z",
  situation: {
    ouOnEnEst: "Le fournisseur a promis une livraison jeudi.",
    prochaineEtape: "En attente de la livraison de ClimaPro.",
    attente: "ClimaPro — la livraison",
    echeance: "2026-10-16",
  },
  resume: "Une livraison de sauce blanche en retard de deux semaines.",
  taches: [
    {
      titre: "Appeler le fournisseur",
      type: "call",
      date: "2026-10-15",
      source: "relvo",
    },
  ],
  contacts: [{ nom: "Karim Benali", entreprise: "ClimaPro", role: "supplier" }],
  messages: Array.from({ length: 3 }, (_, i) => ({
    expediteur: "Karim Benali <karim@climapro.fr>",
    recuLe: `2026-10-1${i}T09:00:00.000Z`,
    objet: "Livraison",
    contenu: "Bonjour, la livraison est décalée. ".repeat(40),
    sens: "entrant" as const,
  })),
};

const instant = { maintenant: "2026-10-15T17:31:00.000Z", page: "/sujets/abc" };

describe("contexte de l'échange — le cache est un préfixe", () => {
  const c = contexteEchange({
    compte,
    domaine: {
      nom: "Fournisseurs",
      description: "Achats et livraisons",
      instructions: [
        {
          titre: "Délais fournisseurs",
          contenu: "Relancer après 48 h. ".repeat(20),
        },
      ],
      documents: [
        {
          nom: "Procédure fournisseurs v3",
          etiquette: "procédure",
          resume: null,
        },
      ],
    },
    brief,
    sujet,
    contact: null,
    instant,
  });

  it("le message système ne porte que la couche Produit de l'échange — rien du compte (#49)", () => {
    expect(c.system).toBe(coucheProduitEchange(compte.secteurs));
    expect(c.system.startsWith(coucheProduit(compte.secteurs))).toBe(true);
    expect(c.system).toContain(SOCLE_ECHANGE);
    for (const propre of [
      "Mam's Crousty",
      "Achats et livraisons",
      "Délais fournisseurs",
      "SUB-0142",
      "Il est",
    ]) {
      expect(c.system, propre).not.toContain(propre);
    }
  });

  it("Compte et Domaine forment le préfixe stable ; Instant et Situation le bloc volatil", () => {
    expect(c.prefixe).toContain("Mam's Crousty");
    expect(c.prefixe).toContain("Délais fournisseurs");
    expect(c.prefixe).not.toContain("Il est");
    expect(c.prefixe).not.toContain("SUB-0142");
    expect(c.volatil).toContain("Il est 19:31, heure française");
    expect(c.volatil).toContain("Page ouverte : /sujets/abc");
    expect(c.volatil).toContain("Sujets ouverts : 12");
    expect(c.volatil).toContain("SUB-0142");
    expect(c.prompt).toBe(`${c.prefixe}\n\n${c.volatil}`);
    expect(prefixeStable(c)).toBe(
      estimerJetons(
        [c.couches.produit, c.couches.compte, c.couches.domaine].join("\n\n"),
      ),
    );
  });

  it("tient ses budgets, couche par couche, sur une fixture pire que la réalité", () => {
    const mesure = mesurerCouches(c);
    for (const couche of [
      "produit",
      "compte",
      "domaine",
      "situation",
      "instant",
    ] as const) {
      expect(mesure[couche], couche).toBeLessThanOrEqual(
        BUDGETS.echange[couche],
      );
    }
    expect(estimerJetons(SOCLE_ECHANGE)).toBeLessThanOrEqual(
      BUDGET_PRODUIT.echange,
    );
  });

  it("hors d'une fiche, la Situation est le brief seul, et le Domaine est vide", () => {
    const general = contexteEchange({
      compte,
      domaine: null,
      brief,
      sujet: null,
      contact: null,
      instant: { maintenant: instant.maintenant, page: "/" },
    });
    expect(general.couches.domaine).toBe("");
    expect(general.volatil).toContain("Aujourd'hui sur le compte");
    expect(general.volatil).not.toContain("SUB-0142");
    expect(general.system).toBe(c.system);
  });
});

describe("le bloc volatil rejoint le dernier message du dirigeant", () => {
  it("entre délimiteurs, devant le texte, et seulement sur le dernier tour", () => {
    const out = injecterVolatil(
      [
        { role: "user", content: "PREFIXE" },
        { role: "user", content: "Première question" },
        { role: "assistant", content: "Réponse" },
        { role: "user", content: "Deuxième question" },
      ],
      "VOLATIL",
    );
    expect(out).toHaveLength(4);
    expect(out[1]!.content).toBe("Première question");
    expect(out[3]!.content).toBe(
      `${DEBUT_CONTEXTE}\nVOLATIL\n${FIN_CONTEXTE}\n\n# Le dirigeant dit\nDeuxième question`,
    );
  });

  it("un contenu en parties reçoit le bloc en première partie ; sans tour du dirigeant, rien", () => {
    const out = injecterVolatil(
      [{ role: "user", content: [{ type: "text", text: "Q" }] }],
      "V",
    );
    const content = out[0]!.content as { type: string; text: string }[];
    expect(content[0]!.text).toContain("V");
    expect(content[1]!.text).toBe("Q");
    expect(injecterVolatil([{ role: "assistant", content: "x" }], "V")).toEqual(
      [{ role: "assistant", content: "x" }],
    );
  });
});

describe("les arguments d'un outil deviennent une entrée du domaine", () => {
  it("une date et une heure dites restent NUES — l'heure française de l'agenda (#55)", () => {
    const input = versCreateTaskInput(
      {
        titre: " Rendez-vous Karim ",
        date: "2026-10-16",
        heure: "10:00",
        heure_fin: "11:00",
        type: "call",
        description: null,
      },
      "sujet-1",
    );
    expect(input.title).toBe("Rendez-vous Karim");
    expect(input.subjectId).toBe("sujet-1");
    expect(input.sourceActor).toBe("user");
    expect(input.kind).toBe("call");
    expect(input.startDate?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(input.startTime?.toISOString()).toBe("2026-10-16T10:00:00.000Z");
    expect(input.endTime?.toISOString()).toBe("2026-10-16T11:00:00.000Z");
  });

  it("sans date, pas d'heure ; sans heure, pas de fin ; une valeur mal formée est ignorée", () => {
    const sans = versCreateTaskInput(
      {
        titre: "Rappeler",
        date: null,
        heure: "10:00",
        heure_fin: null,
        type: null,
        description: "  ",
      },
      null,
    );
    expect(sans.startDate).toBeNull();
    expect(sans.startTime).toBeNull();
    expect(sans.description).toBeNull();
    expect("kind" in sans).toBe(false);
    const fin = versCreateTaskInput(
      {
        titre: "x",
        date: "2026-10-16",
        heure: null,
        heure_fin: "11:00",
        type: null,
        description: null,
      },
      null,
    );
    expect(fin.startDate).not.toBeNull();
    expect(fin.endTime).toBeNull();
    expect(heureNue("demain", "10h")).toBeNull();
  });

  it("une période de tâches devient des jours français ; des jours explicites l'emportent", () => {
    // Lundi 19 octobre 2026, 10 h 58 à Paris.
    const now = new Date("2026-10-19T08:58:00.000Z");
    expect(bornesPeriode("aujourd_hui", now)).toEqual({
      depuis: "2026-10-19",
      jusquAu: "2026-10-19",
      sansDate: false,
      enRetard: false,
    });
    expect(bornesPeriode("demain", now).depuis).toBe("2026-10-20");
    // « La semaine » va d'aujourd'hui à dimanche — pas sept jours glissants.
    expect(bornesPeriode("semaine", now)).toMatchObject({
      depuis: "2026-10-19",
      jusquAu: "2026-10-25",
    });
    // Après minuit à Paris, « aujourd'hui » est déjà le nouveau jour (#55).
    expect(
      bornesPeriode("aujourd_hui", new Date("2026-10-18T22:30:00.000Z")).depuis,
    ).toBe("2026-10-19");
    expect(bornesPeriode("en_retard", now)).toMatchObject({
      enRetard: true,
      depuis: null,
    });
    expect(bornesPeriode("sans_date", now).sansDate).toBe(true);
    expect(bornesPeriode("sujet", now)).toEqual(bornesPeriode(null, now));
    // « Lundi prochain » : des jours explicites, qui l'emportent sur la période.
    expect(
      bornesPeriode("semaine", now, {
        depuis: "2026-10-26",
        jusquAu: "2026-10-26",
      }),
    ).toEqual({
      depuis: "2026-10-26",
      jusquAu: "2026-10-26",
      sansDate: false,
      enRetard: false,
    });
    // Un jour mal formé est ignoré, pas deviné.
    expect(bornesPeriode("demain", now, { depuis: "lundi" }).depuis).toBe(
      "2026-10-20",
    );
    expect(titreTaches("semaine", null)).toBe("Tâches de la semaine");
    expect(titreTaches("semaine", "faites")).toBe("Tâches faites");
    expect(titreTaches(null, null)).toBe("Tâches");
  });

  it("la page d'origine désigne le sujet ou le contact ouvert, et rien d'autre", () => {
    const id = "0f5a2d5e-7c3b-4a1e-9b2d-1c2d3e4f5a6b";
    expect(lirePage(`/sujets/${id}`)).toEqual({
      page: `/sujets/${id}`,
      subjectId: id,
      contactId: null,
    });
    expect(lirePage(`/contacts/${id}`).contactId).toBe(id);
    expect(lirePage("/fil")).toEqual({
      page: "/fil",
      subjectId: null,
      contactId: null,
    });
    expect(lirePage("/sujets/nouveau").subjectId).toBeNull();
    expect(lirePage(null).page).toBeNull();
  });
});

const usage = {
  inputTokens: {
    total: 100,
    noCache: 100,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

/** Un modèle qui appelle TOUJOURS l'outil : c'est le plafond d'étapes qui l'arrête. */
function modeleQuiBoucle() {
  let n = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          {
            type: "tool-call",
            toolCallId: `appel-${++n}`,
            toolName: "create_task",
            input: JSON.stringify({ titre: `Tâche ${n}` }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            logprobs: undefined,
            usage,
          },
        ],
      }),
    }),
  });
}

describe("un tour de l'échange, par chat()", () => {
  it("exécute l'outil avec ses arguments, s'arrête au plafond d'étapes, et rend sa mesure", async () => {
    const execute = vi.fn(async ({ titre }: { titre: string }) => ({
      type: "tache-creee",
      titre,
    }));
    const modele = modeleQuiBoucle();
    const { flux, mesure } = chat({
      sollicitation: "banc-essai",
      system: "système",
      messages: [{ role: "user", content: "Crée une tâche" }],
      tools: {
        create_task: tool({
          description: "Crée une tâche",
          inputSchema: z.object({ titre: z.string() }),
          execute,
        }),
      },
      reasoning: "medium",
      modele,
    });
    await flux.consumeStream();
    expect(execute).toHaveBeenCalledTimes(PLAFONDS.etapesParTour);
    expect(execute.mock.calls[0]![0]).toEqual({ titre: "Tâche 1" });
    expect(modele.doStreamCalls).toHaveLength(PLAFONDS.etapesParTour);
    const m = await mesure;
    expect(m.sollicitation).toBe("banc-essai");
    expect(m.tier).toBe("raisonnement");
    expect(m.jetons.entree).toBe(100 * PLAFONDS.etapesParTour);
  });

  it("un plafond d'étapes plus bas, posé par le site d'appel, est respecté", async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const { flux } = chat({
      sollicitation: "banc-essai",
      prompt: "x",
      tools: {
        create_task: tool({
          inputSchema: z.object({ titre: z.string() }),
          execute,
        }),
      },
      reasoning: "low",
      tier: "extraction",
      maxEtapes: 2,
      modele: modeleQuiBoucle(),
    });
    await flux.consumeStream();
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

describe("la fenêtre d'annulation, tenue par l'écran", () => {
  it("« Annuler » reste actif quelques minutes après le geste, puis s'éteint", async () => {
    const { annulable, FENETRE_ANNULATION_MS } =
      await import("@/lib/relvo-annulation");
    const a = "2026-10-15T20:00:00.000Z";
    const t0 = Date.parse(a);
    const geste = { type: "tache" as const, id: "x", a };
    expect(annulable(geste, t0 + 1_000)).toBe(true);
    expect(annulable(geste, t0 + FENETRE_ANNULATION_MS - 1)).toBe(true);
    expect(annulable(geste, t0 + FENETRE_ANNULATION_MS)).toBe(false);
    expect(annulable({ ...geste, a: "hier" }, t0)).toBe(false);
  });
});

describe("la mémoire locale des échanges — les règles (05 §11.2–§11.4)", () => {
  it("rouvre l'échange en cours en deçà de cinq minutes, sinon un nouvel échange", async () => {
    const { doitReprendre, SESSION_REPRISE_MS } =
      await import("@/lib/echanges-regles");
    const t0 = Date.parse("2026-10-15T20:00:00.000Z");
    const il_y_a = (ms: number) => new Date(t0 - ms).toISOString();
    expect(doitReprendre(il_y_a(30_000), t0)).toBe(true);
    expect(doitReprendre(il_y_a(SESSION_REPRISE_MS - 1), t0)).toBe(true);
    expect(doitReprendre(il_y_a(SESSION_REPRISE_MS), t0)).toBe(false);
    expect(doitReprendre(il_y_a(60 * 60_000), t0)).toBe(false);
    expect(doitReprendre("n'importe quoi", t0)).toBe(false);
  });

  it("garde les dix plus récents, nomme ce qui dépasse", async () => {
    const { purger, HISTORIQUE_MAX } = await import("@/lib/echanges-regles");
    const xs = Array.from({ length: 13 }, (_, i) => ({
      id: `e${i}`,
      dernierTourLe: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    }));
    const { gardes, supprimes } = purger(xs);
    expect(gardes).toHaveLength(HISTORIQUE_MAX);
    expect(gardes[0]!.id).toBe("e12");
    expect(supprimes.map((s) => s.id)).toEqual(["e2", "e1", "e0"]);
  });

  it("le titre de repli borne les premiers mots ; le titre du modèle est nettoyé de même", async () => {
    const { titreParDefaut, nettoyerTitre, TITRE_MAX } =
      await import("@/lib/echanges-regles");
    expect(titreParDefaut("  Qu'est-ce qui est urgent aujourd'hui ?  ")).toBe(
      "Qu'est-ce qui est urgent aujourd'hui ?",
    );
    const long = titreParDefaut(
      "Prépare une réponse à Karim pour relancer sur la rupture de sauce blanche et demander un point",
    );
    expect(long.length).toBeLessThanOrEqual(TITRE_MAX + 1);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
    expect(titreParDefaut("   ")).toBe("Échange");
    expect(nettoyerTitre("« Rendez-vous Karim demain 10h. »")).toBe(
      "Rendez-vous Karim demain 10h",
    );
    expect(nettoyerTitre("")).toBe("Échange");
  });
});

describe("le titre d'un échange — un appel de classification (M10.4)", () => {
  it("système constant, tour dans le message utilisateur, titre nettoyé, mesure du tier classification", async () => {
    const { titrerEchange, SYSTEME_TITRE } =
      await import("@/server/ia/echange/titre");
    const modele = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: '{"titre":"« Rendez-vous Karim demain 10h. »"}',
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 300,
            noCache: 300,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 12, text: 12, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const { titre, mesure } = await titrerEchange({
      question: "Pose-moi un rendez-vous avec Karim demain à 10h",
      reponse: "C'est fait : demain 10h, avec Karim.",
      modele,
    });
    expect(titre).toBe("Rendez-vous Karim demain 10h");
    expect(mesure.sollicitation).toBe("titre-echange");
    expect(mesure.tier).toBe("classification");
    const appel = modele.doGenerateCalls[0]!;
    const systeme = appel.prompt.find((m) => m.role === "system");
    expect(systeme && "content" in systeme ? systeme.content : null).toBe(
      SYSTEME_TITRE,
    );
    expect(JSON.stringify(appel.prompt)).toContain("Pose-moi un rendez-vous");
  });
});

describe("le tier par tour (M10.11) — des règles écrites, jamais un appel de plus", async () => {
  const { tierDuTour, arretDuTour } = await import("@/server/ia/echange/tier");
  it("une question de lecture, courte, sans geste, passe en extraction", () => {
    for (const q of [
      "Qu'est-ce qui est urgent aujourd'hui ?",
      "Combien de tâches en retard ?",
      "Quelles sujets attendent une réponse ?",
      "Qui est Karim Benali ?",
      "Où en est la rupture de sauce blanche ?",
      "Mes tâches de la semaine",
      "Montre-moi les sujets ouverts",
      "Retrouve le mail de la DDPP",
    ]) {
      expect(tierDuTour(q), q).toBe("extraction");
    }
  });
  it("un geste, une rédaction, un résumé, une question longue ou composée passent en raisonnement", () => {
    for (const q of [
      "Crée-moi une tâche : rappeler le plombier lundi",
      "Pose un rendez-vous avec Karim demain à 10h",
      "Prépare une réponse à Karim pour relancer",
      "Résume-moi ce sujet",
      "Marque ce sujet comme réglée",
      "Retiens que les devis au-dessus de 5000 € passent par moi",
      "Qu'est-ce qui est urgent ? Et qu'est-ce que je dois faire en premier ?",
      "Si la livraison n'arrive pas jeudi, qu'est-ce que je fais ?",
      "Quelles sont les sujets ouverts dont le dernier message date de plus d'une semaine et qui n'ont aucune tâche planifiée pour les dix prochains jours ?",
      "",
    ]) {
      expect(tierDuTour(q), q || "(vide)").toBe("raisonnement");
    }
  });
  it("ce qui arrête un tour avant la fin se nomme : le plafond d'étapes, la sortie trop longue", () => {
    expect(arretDuTour("tool-calls")).toBe("plafond");
    expect(arretDuTour("length")).toBe("longueur");
    expect(arretDuTour("stop")).toBeNull();
    expect(arretDuTour(undefined)).toBeNull();
  });
});

describe("les erreurs du fil, en langage client (M10.15)", async () => {
  const { phraseErreur, phraseArret, ERREUR_GENERIQUE } =
    await import("@/lib/echange-erreurs");
  it("session expirée, réseau, échange trop long, surcharge, et le reste", () => {
    expect(phraseErreur('{"error":"Non authentifié."}').lien?.href).toContain(
      "/connexion",
    );
    expect(phraseErreur("Failed to fetch").reessayer).toBe(true);
    expect(phraseErreur("Failed to fetch").phrase).toContain("réseau");
    expect(
      phraseErreur("Cet échange est devenu trop long pour moi.").lien?.href,
    ).toBe("/relvo?nouveau=1");
    expect(phraseErreur("429 Too Many Requests").phrase).toContain("sollicité");
    expect(
      phraseErreur("Je n'ai pas pu répondre. Réessayez dans un instant.")
        .phrase,
    ).toBe("Je n'ai pas pu répondre. Réessayez dans un instant.");
    expect(
      phraseErreur("TypeError: cannot read properties of undefined {x}"),
    ).toEqual(ERREUR_GENERIQUE);
    expect(phraseErreur(undefined)).toEqual(ERREUR_GENERIQUE);
    expect(phraseArret("plafond")).toContain("la suite");
  });
});

describe("l'historique rejoué repart en clair — sans ancre du fournisseur (PITFALLS #63)", async () => {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { convertToModelMessages, streamText } = await import("ai");
  const { sansAncresFournisseur } =
    await import("@/server/ia/echange/conversions");
  const outils = {
    list_subjects: tool({ inputSchema: z.object({}) }),
  };
  // Ce que le téléphone renvoie après un tour : l'appel d'outil et le texte
  // portent l'identifiant d'item OpenAI, le raisonnement n'a jamais été envoyé.
  const historique = [
    {
      id: "u1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Qu'est-ce qui est urgent ?" }],
    },
    {
      id: "a1",
      role: "assistant" as const,
      parts: [
        { type: "step-start" as const },
        {
          type: "tool-list_subjects" as const,
          toolCallId: "call_1",
          state: "output-available" as const,
          input: {},
          output: { type: "affaires", items: [] },
          callProviderMetadata: { openai: { itemId: "fc_1" } },
        },
        { type: "step-start" as const },
        {
          type: "text" as const,
          text: "Rien d'urgent.",
          state: "done" as const,
          providerMetadata: {
            openai: { itemId: "msg_1", phase: "final_answer" },
          },
        },
      ],
    },
    {
      id: "u2",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Et demain ?" }],
    },
  ];

  async function corpsEnvoye(
    messages: Awaited<ReturnType<typeof convertToModelMessages>>,
  ) {
    let corps: { input: Array<Record<string, unknown>> } | undefined;
    const openai = createOpenAI({
      apiKey: "test",
      fetch: async (_url, init) => {
        corps = JSON.parse(String(init?.body));
        return new Response("data: [DONE]\n\n", {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
    });
    const flux = streamText({
      model: openai("gpt-5.6-terra"),
      messages,
      tools: outils,
    });
    await flux.consumeStream({ onError: () => undefined });
    return corps!;
  }

  it("avec ses ancres, le tour précédent serait RÉFÉRENCÉ chez OpenAI — ce que la règle interdit", async () => {
    const brut = await convertToModelMessages(historique, { tools: outils });
    const corps = await corpsEnvoye(brut);
    // Seul le texte est référencé : un appel d'outil ordinaire repart toujours
    // en clair (`function_call`, sans identifiant d'item).
    expect(
      corps.input.filter((i) => i.type === "item_reference").map((i) => i.id),
    ).toEqual(["msg_1"]);
    expect(
      corps.input.find((i) => i.type === "function_call"),
    ).not.toHaveProperty("id");
  });

  it("sans ancre, le texte et l'appel d'outil repartent en clair, et le raisonnement est écarté", async () => {
    // Le SDK découpe un tour en autant de messages assistant que d'étapes :
    // l'appel d'outil, puis le texte. Un raisonnement glissé devant le texte
    // (comme si le téléphone l'avait gardé) doit disparaître aussi.
    const brut = await convertToModelMessages(historique, { tools: outils });
    const dernierAssistant = [...brut]
      .reverse()
      .find((m) => m.role === "assistant")!;
    const avecRaisonnement = brut.map((m) =>
      m === dernierAssistant && Array.isArray(m.content)
        ? {
            ...m,
            content: [
              {
                type: "reasoning" as const,
                text: "",
                providerOptions: { openai: { itemId: "rs_1" } },
              },
              ...m.content,
            ],
          }
        : m,
    );
    const propre = sansAncresFournisseur(avecRaisonnement);
    const parts = propre
      .filter((m) => m.role === "assistant")
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []));
    expect(parts.map((p) => p.type)).toEqual(["tool-call", "text"]);
    for (const p of parts as Array<{
      providerOptions?: Record<string, Record<string, unknown>>;
    }>) {
      expect(p.providerOptions?.openai).not.toHaveProperty("itemId");
    }
    // La phase du texte, elle, reste : seule l'ancre part.
    expect(
      (
        parts as Array<{
          type: string;
          providerOptions?: { openai?: { phase?: string } };
        }>
      ).find((p) => p.type === "text")?.providerOptions?.openai?.phase,
    ).toBe("final_answer");
    // Les messages du dirigeant ne sont pas touchés.
    expect(propre.filter((m) => m.role === "user")).toEqual(
      brut.filter((m) => m.role === "user"),
    );

    const corps = await corpsEnvoye(propre);
    expect(corps.input.some((i) => i.type === "item_reference")).toBe(false);
    const appel = corps.input.find((i) => i.type === "function_call")!;
    expect(appel).toMatchObject({ call_id: "call_1", name: "list_subjects" });
    expect(appel).not.toHaveProperty("id");
    const texte = corps.input.find((i) => i.role === "assistant")!;
    expect(texte).not.toHaveProperty("id");
    expect(corps.input.some((i) => i.type === "reasoning")).toBe(false);
  });
});
