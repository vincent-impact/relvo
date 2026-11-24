import { describe, expect, it } from "vitest";
import { identiteDuParticipant, identiteDuWebhook } from "@/server/unipile/map";

// Ce que l'agrégateur dit de quelqu'un, tel que l'annuaire le note (M29.1).
// Les formes sont celles vérifiées sur un groupe réel.

describe("nourrir l'annuaire depuis l'agrégateur", () => {
  it("l'expéditeur d'un webhook : son identifiant interne, son numéro, son nom", () => {
    expect(
      identiteDuWebhook({
        attendee_name: "Dahmani Eya",
        attendee_provider_id: "265338952376336@lid",
        attendee_public_identifier: "33612345678@s.whatsapp.net",
        attendee_specifics: { phone_number: "+33612345678" },
      }),
    ).toEqual([
      {
        internalId: "265338952376336@lid",
        phone: "+33612345678",
        name: "Dahmani Eya",
        isSelf: undefined,
      },
    ]);
    // L'auteur d'un message envoyé par le compte, c'est le dirigeant.
    expect(
      identiteDuWebhook({ provider_id: "19@lid" }, { isSelf: true })[0],
    ).toMatchObject({ internalId: "19@lid", isSelf: true });
    expect(identiteDuWebhook(null)).toEqual([]);
  });

  it("un participant d'un fil : « c'est moi » vient de la liste", () => {
    expect(
      identiteDuParticipant({
        provider_id: "190000000000001@lid",
        public_identifier: "33600000000@s.whatsapp.net",
        name: "Vincent",
        is_self: 1,
      }),
    ).toEqual({
      internalId: "190000000000001@lid",
      phone: "33600000000@s.whatsapp.net",
      name: "Vincent",
      isSelf: true,
    });
  });
});
