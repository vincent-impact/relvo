import { describe, expect, it } from "vitest";
import { refusSuppression } from "@/server/admin-regles";

// LES REFUS DU BACKOFFICE (M21.4) — la seule opération irréversible du produit
// a trois gardes, et chacune est un comportement livré.

const base = {
  cibleId: "cible",
  cibleEmail: "test@relvo.fr",
  adminId: "admin",
  demoId: "demo",
};

describe("refusSuppression", () => {
  it("accepte quand l'e-mail retapé est celui du compte, casse et espaces mis à part", () => {
    expect(refusSuppression({ ...base, emailSaisi: "test@relvo.fr" })).toBe(
      null,
    );
    expect(refusSuppression({ ...base, emailSaisi: "  Test@Relvo.FR " })).toBe(
      null,
    );
  });

  it("refuse un e-mail qui ne correspond pas", () => {
    expect(refusSuppression({ ...base, emailSaisi: "autre@relvo.fr" })).toBe(
      "email_different",
    );
    expect(refusSuppression({ ...base, emailSaisi: "" })).toBe(
      "email_different",
    );
  });

  it("refuse de supprimer le compte de l'administrateur lui-même, même avec le bon e-mail", () => {
    expect(
      refusSuppression({
        ...base,
        cibleId: "admin",
        emailSaisi: "test@relvo.fr",
      }),
    ).toBe("soi_meme");
  });

  it("refuse le compte de démonstration, recréé à chaque build", () => {
    expect(
      refusSuppression({
        ...base,
        cibleId: "demo",
        emailSaisi: "test@relvo.fr",
      }),
    ).toBe("compte_demonstration");
  });
});
