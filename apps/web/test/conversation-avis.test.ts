import { describe, expect, it } from "vitest";
import type { ConversationTriage } from "@relvo/db";
import {
  CONSEIL_LABELS,
  NATURE_LABELS,
  toIgnoreData,
  toRelvoVerdictData,
} from "@/lib/conversation-row";

// L'AVIS DE TRI À L'ÉCRAN : deux informations, jamais mêlées — la nature (de
// quoi il s'agit) et le conseil (ce que Relvo en ferait). Ce fichier tient la
// traduction de l'avis stocké vers ces deux badges.

const avis = (
  verdict: ConversationTriage["verdict"],
  nature: ConversationTriage["nature"],
): ConversationTriage =>
  ({
    verdict,
    nature,
    confidence: "medium",
    reason: "Une phrase de Relvo.",
    at: new Date(),
  }) as ConversationTriage;

describe("le conseil de Relvo", () => {
  it("« à traiter » et « à considérer » conseillent de regarder, « rien à faire » d'ignorer", () => {
    expect(toRelvoVerdictData(avis("matter", "professional"))?.conseil).toBe(
      "considerer",
    );
    expect(toRelvoVerdictData(avis("uncertain", "personal"))?.conseil).toBe(
      "considerer",
    );
    expect(toRelvoVerdictData(avis("noise", "advertising"))?.conseil).toBe(
      "ignorer",
    );
    expect(CONSEIL_LABELS).toEqual({
      considerer: "À considérer",
      ignorer: "À ignorer",
    });
  });

  it("sans avis stocké, rien : la ligne dira « Sans avis »", () => {
    expect(toRelvoVerdictData(null)).toBeNull();
  });

  it("la nature est portée à part, dans ses propres mots", () => {
    const data = toRelvoVerdictData(avis("uncertain", "automatic"));
    expect(data?.nature).toBe("automatic");
    expect(NATURE_LABELS[data!.nature!]).toBe("Automatique");
    expect(toRelvoVerdictData(avis("noise", null))?.nature).toBeNull();
  });
});

describe("la nature d'une conversation ignorée", () => {
  it("par Relvo : la nature de son avis, pas la raison enregistrée", () => {
    const data = toIgnoreData(
      { by: "ai", reason: "other", note: null },
      avis("noise", "professional"),
    );
    expect(data).toMatchObject({ byRelvo: true, nature: "professional" });
  });

  it("par l'utilisateur : la raison qu'il a choisie, même si Relvo avait un avis", () => {
    const data = toIgnoreData(
      { by: "user", reason: "not_my_role", note: null },
      avis("uncertain", "professional"),
    );
    expect(data).toMatchObject({ byRelvo: false, nature: "not_my_role" });
    expect(NATURE_LABELS[data!.nature!]).toBe("Pas mon rôle");
  });

  it("sans raison dite, aucune nature : le badge dira seulement par qui", () => {
    expect(
      toIgnoreData({ by: "user", reason: null, note: null }, null)?.nature,
    ).toBeNull();
  });
});
