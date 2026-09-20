import { describe, expect, it } from "vitest";
import {
  AI_CACHE_SILENT_RATIO,
  AI_CACHE_WINDOW_MS,
  listAiSolicitations,
  logAiSolicitation,
  prisma,
  summarizeAiSolicitations,
  tenantDb,
  type AiSolicitationRow,
} from "../src/index";

// LE COMPTEUR RELU (M7.13, M7.16 — tranche 8). Ce que le journal consigne par
// sollicitation — dont le préfixe stable attendu en cache —, ce que la lecture
// en rend, et la synthèse : coût par sollicitation, cache lu confronté au
// cache attendu, et les SILENCIEUX — un appel dont le préfixe aurait dû être
// en cache et ne l'était pas.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  return { account, db: tenantDb(account.id) };
}

const mesure = {
  tier: "extraction",
  modele: "gpt-5.6-luna",
  niveau: "low",
  cout: { eur: 0.0002, usd: 0.00023, version: "2026-09-13" },
  dureeMs: 1_200,
};

function ligne(
  at: string,
  cacheLecture: number,
  prefixeStable: number | null,
  sollicitation = "tri",
): AiSolicitationRow {
  return {
    at: new Date(at),
    sollicitation,
    tier: "extraction",
    modele: "gpt-5.6-luna",
    niveau: "low",
    jetons: {
      entree: 500,
      cacheLecture,
      cacheEcriture: 0,
      sortie: 80,
      raisonnement: 10,
    },
    coutEur: 0.0002,
    dureeMs: 1_000,
    prefixeStable,
    lot: false,
    reponseId: null,
    subjectId: null,
    messageId: null,
  };
}

describe("le journal des sollicitations", () => {
  it("consigne le préfixe stable attendu, et la lecture le rend avec le reste", async () => {
    const { db } = await makeAccount("journal@test.fr");
    await logAiSolicitation(db, {
      ...mesure,
      sollicitation: "tri",
      jetons: {
        entree: 600,
        cacheLecture: 1_700,
        cacheEcriture: 0,
        sortie: 90,
        raisonnement: 0,
      },
      prefixeStable: 1_900,
      reponseId: "resp_1",
    });
    await logAiSolicitation(db, {
      ...mesure,
      sollicitation: "brouillon",
      tier: "redaction",
      jetons: {
        entree: 2_400,
        cacheLecture: 0,
        cacheEcriture: 0,
        sortie: 140,
        raisonnement: 98,
      },
    });
    const lignes = await listAiSolicitations(db, {
      since: new Date(Date.now() - 60_000),
    });
    expect(lignes.map((l) => l.sollicitation)).toEqual(["tri", "brouillon"]);
    expect(lignes[0].prefixeStable).toBe(1_900);
    expect(lignes[0].jetons.cacheLecture).toBe(1_700);
    expect(lignes[0].reponseId).toBe("resp_1");
    expect(lignes[1].prefixeStable).toBeNull();
    expect(lignes[1].jetons.raisonnement).toBe(98);

    // La fenêtre : rien avant.
    expect(
      await listAiSolicitations(db, { since: new Date(Date.now() + 60_000) }),
    ).toEqual([]);
  });
});

describe("la synthèse des sollicitations", () => {
  it("agrège par sollicitation, la plus coûteuse en tête, et confronte le cache lu au cache attendu", () => {
    const s = summarizeAiSolicitations([
      ligne("2026-09-20T08:00:00Z", 0, 1_900),
      ligne("2026-09-20T08:01:00Z", 1_800, 1_900),
      ligne("2026-09-20T08:02:00Z", 2_300, 2_600, "structuration"),
      ligne("2026-09-20T08:03:00Z", 0, null, "brouillon"),
    ]);
    expect(s.map((x) => x.sollicitation)).toEqual([
      "tri",
      "structuration",
      "brouillon",
    ]);
    const tri = s[0];
    expect(tri.appels).toBe(2);
    expect(tri.coutEur).toBeCloseTo(0.0004, 6);
    expect(tri.entree).toBe(500 + 500 + 1_800);
    expect(tri.mesures).toBe(2);
    expect(tri.prefixeStable).toBe(3_800);
    expect(tri.cacheLectureMesuree).toBe(1_800);
    expect(tri.dureeMsMoyenne).toBe(1_000);
    expect(s[2].mesures).toBe(0);
  });

  it("nomme les silencieux : un préfixe chaud qui n'a pas été relu — jamais le premier appel d'une fenêtre", () => {
    const rows = [
      // Premier appel : cache froid, normal.
      ligne("2026-09-20T08:00:00Z", 0, 1_900),
      // Une minute après : le préfixe devait être chaud, rien n'est relu → silencieux.
      ligne("2026-09-20T08:01:00Z", 0, 1_900),
      // Relu en partie, au-dessus de la part attendue : sain.
      ligne(
        "2026-09-20T08:02:00Z",
        Math.ceil(1_900 * AI_CACHE_SILENT_RATIO),
        1_900,
      ),
      // Relu en deçà de la part attendue : silencieux.
      ligne("2026-09-20T08:03:00Z", 400, 1_900),
      // Après la fenêtre : cache froid à nouveau, normal.
      ligne(
        new Date(
          new Date("2026-09-20T08:03:00Z").getTime() + AI_CACHE_WINDOW_MS + 1,
        ).toISOString(),
        0,
        1_900,
      ),
      // Sans préfixe mesuré : jamais jugé.
      ligne("2026-09-20T10:00:00Z", 0, null),
    ];
    const [tri] = summarizeAiSolicitations(rows);
    expect(tri.silencieux.map((r) => r.at.toISOString())).toEqual([
      "2026-09-20T08:01:00.000Z",
      "2026-09-20T08:03:00.000Z",
    ]);
    expect(tri.mesures).toBe(5);
  });

  it("la fenêtre de cache est celle d'un appel au suivant, toutes sollicitations confondues", () => {
    const [structuration, tri] = summarizeAiSolicitations([
      ligne("2026-09-20T08:00:00Z", 0, 1_900, "tri"),
      // La structuration suit le tri de quelques secondes : son préfixe partagé doit être chaud.
      ligne("2026-09-20T08:00:05Z", 0, 2_600, "structuration"),
    ]).sort((a, b) => a.sollicitation.localeCompare(b.sollicitation));
    expect(structuration.silencieux).toHaveLength(1);
    expect(tri.silencieux).toHaveLength(0);
  });
});
