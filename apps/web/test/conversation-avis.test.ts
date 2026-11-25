import { describe, expect, it } from "vitest";
import type { ConversationTriage } from "@relvo/db";
import {
  CONSEIL_LABELS,
  NATURE_LABELS,
  libelleDeNature,
  toIgnoreData,
  toRelvoVerdictData,
} from "@/lib/conversation-row";

// L'AVIS DE TRI À L'ÉCRAN : deux informations, jamais mêlées — le conseil (ce
// que Relvo en ferait) et la nature (de quoi il s'agit). Ce fichier tient la
// traduction de l'avis stocké vers ces deux badges.

const avis = (
  verdict: ConversationTriage["verdict"],
  nature: ConversationTriage["nature"],
): ConversationTriage => ({
  verdict,
  nature,
  confidence: "medium",
  reason: "Une phrase de Relvo.",
  at: new Date(),
});

describe("le conseil de Relvo", () => {
  it("« à traiter » et « à considérer » conseillent de traiter, « rien à faire » d'ignorer", () => {
    expect(toRelvoVerdictData(avis("matter", "professional"))?.conseil).toBe(
      "traiter",
    );
    expect(toRelvoVerdictData(avis("uncertain", "personal"))?.conseil).toBe(
      "traiter",
    );
    expect(toRelvoVerdictData(avis("noise", "advertising"))?.conseil).toBe(
      "ignorer",
    );
    expect(CONSEIL_LABELS).toEqual({
      traiter: "À traiter",
      ignorer: "À ignorer",
    });
  });

  it("sans avis stocké, rien : la ligne dira « Sans avis »", () => {
    expect(toRelvoVerdictData(null)).toBeNull();
  });

  it("la nature est portée à part, dans ses propres mots", () => {
    const data = toRelvoVerdictData(avis("noise", "unwanted"));
    expect(data?.nature).toBe("unwanted");
    expect(NATURE_LABELS).toEqual({
      professional: "Professionnel",
      personal: "Personnel",
      advertising: "Publicité",
      automatic: "E-mail automatique",
      unwanted: "Indésirable",
    });
    expect(toRelvoVerdictData(avis("noise", null))?.nature).toBeNull();
  });

  it("« automatique » se dit pour le canal, les autres natures pareil partout", () => {
    expect(libelleDeNature("automatic", "email")).toBe("E-mail automatique");
    expect(libelleDeNature("automatic", "whatsapp")).toBe(
      "Message automatique",
    );
    expect(libelleDeNature("advertising", "whatsapp")).toBe("Publicité");
    expect(libelleDeNature("professional", "email")).toBe("Professionnel");
  });
});

describe("une conversation ignorée", () => {
  it("par Relvo : la nature de son avis", () => {
    const data = toIgnoreData(
      { by: "ai", reason: "other", note: null },
      avis("noise", "professional"),
    );
    expect(data).toMatchObject({ byRelvo: true, nature: "professional" });
  });

  it("par le dirigeant : la nature que Relvo avait posée reste affichée", () => {
    const data = toIgnoreData(
      { by: "user", reason: null, note: null },
      avis("uncertain", "personal"),
    );
    expect(data).toMatchObject({ byRelvo: false, nature: "personal" });
  });

  it("par le dirigeant, sans avis de Relvo : aucune nature", () => {
    expect(
      toIgnoreData({ by: "user", reason: "not_my_role", note: null }, null)
        ?.nature,
    ).toBeNull();
  });
});
