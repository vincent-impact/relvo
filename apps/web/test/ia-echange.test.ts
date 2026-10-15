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
  DEBUT_CONTEXTE,
  FIN_CONTEXTE,
  heureNue,
  injecterVolatil,
  lirePage,
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
    titre: `Affaire urgente numéro ${i + 1} avec un titre de longueur ordinaire`,
  })),
  tachesDuJour: 3,
  tachesEnRetard: 2,
  conversationsATrier: 4,
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

  it("la page d'origine désigne l'affaire ou le contact ouvert, et rien d'autre", () => {
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
