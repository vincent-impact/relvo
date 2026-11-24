import { describe, expect, it } from "vitest";
import { compteLong, phraseDuRetour, trouARelire } from "@/lib/trou";
import { annuaireDuFil, messageRelu } from "@/server/unipile/map";

// LE RETOUR D'UNE CONVERSATION IGNORÉE (M25.10) — ce qui est pur : traduire un
// message relu chez l'agrégateur, et dire le compte et le bilan dans les mots
// de l'utilisateur. La lecture elle-même parle à un fournisseur ; la garde et
// le solde du trou sont testés dans le domaine (`reception.test.ts`).

const annuaire = annuaireDuFil([
  {
    provider_id: "247665161986095@lid",
    name: "Dahmani Eya",
    specifics: { phone_number: "+33629526812" },
  },
  {
    provider_id: "14774872051934@lid",
    public_identifier: "33637573675@s.whatsapp.net",
    name: "Moi",
    is_self: 1,
  },
  { name: "Sans identifiant" },
]);

describe("annuaireDuFil", () => {
  it("traduit l'identifiant interne en numéro et en nom", () => {
    expect(annuaire.get("247665161986095@lid")).toEqual({
      numero: "+33629526812",
      nom: "Dahmani Eya",
    });
    // À défaut de numéro explicite, l'identifiant public, sans son suffixe.
    expect(annuaire.get("14774872051934@lid")?.numero).toBe("33637573675");
    expect(annuaire.size).toBe(2);
  });
});

describe("messageRelu", () => {
  const direct = {
    channelId: "00000000-0000-4000-8000-000000000001",
    chatId: "chat-1",
    groupe: false,
    interlocuteur: "+33611111111",
    annuaire: new Map(),
  };
  const groupe = { ...direct, groupe: true, interlocuteur: null, annuaire };

  it("fil direct : l'expéditeur est l'interlocuteur de la conversation", () => {
    const r = messageRelu(
      {
        id: "m1",
        text: " Vous avez reçu mon devis ? ",
        timestamp: "2026-11-23T18:20:45.000Z",
        is_sender: 0,
        sender_id: "999@lid",
      },
      direct,
    );
    expect(r).toEqual({
      sens: "recu",
      entrant: {
        channelId: direct.channelId,
        externalId: "m1",
        externalThreadId: "chat-1",
        senderRaw: "+33611111111",
        senderName: null,
        isGroup: false,
        content: "Vous avez reçu mon devis ?",
        receivedAt: new Date("2026-11-23T18:20:45.000Z"),
      },
    });
  });

  it("groupe : l'annuaire donne le numéro et le nom de qui a écrit", () => {
    const r = messageRelu(
      { id: "g1", text: "Qui signe ?", sender_id: "247665161986095@lid" },
      groupe,
    );
    expect(r.sens).toBe("recu");
    if (r.sens !== "recu") return;
    expect(r.entrant.senderRaw).toBe("+33629526812");
    expect(r.entrant.senderName).toBe("Dahmani Eya");
    expect(r.entrant.isGroup).toBe(true);
  });

  it("groupe : un expéditeur que l'annuaire ne connaît pas est laissé", () => {
    expect(
      messageRelu({ id: "g2", text: "Bonjour", sender_id: "1@lid" }, groupe),
    ).toEqual({ sens: "laisse", motif: "sans-expediteur" });
  });

  it("ce que le dirigeant a écrit depuis son téléphone revient comme un envoi", () => {
    const r = messageRelu({ id: "s1", text: "Oui.", is_sender: 1 }, direct);
    expect(r.sens).toBe("envoye");
    if (r.sens !== "envoye") return;
    expect(r.sortant.externalId).toBe("s1");
    expect(r.sortant.content).toBe("Oui.");
  });

  it("une réaction et un message sans texte ne reviennent pas", () => {
    expect(messageRelu({ id: "e1", text: "👍", is_event: 1 }, direct)).toEqual({
      sens: "laisse",
      motif: "evenement",
    });
    expect(
      messageRelu({ id: "p1", text: "  ", attachments: [{}] }, direct),
    ).toEqual({ sens: "laisse", motif: "sans-texte" });
  });
});

describe("les mots du trou", () => {
  it("le compte, en toutes lettres en tête du fil", () => {
    expect(compteLong({ count: 12, since: "3 nov." })).toBe(
      "12 messages n'ont pas été importés depuis le 3 nov.",
    );
    expect(compteLong({ count: 1, since: null })).toBe(
      "1 message n'a pas été importé.",
    );
    expect(trouARelire({ count: 3, since: null })).toMatch(/^3 messages reçus/);
  });

  it("le bilan dit ce qui est retrouvé, et ce qui manque", () => {
    expect(phraseDuRetour({ attendus: 12, retrouves: 12, complet: true })).toBe(
      "12 messages retrouvés.",
    );
    expect(phraseDuRetour({ attendus: 1, retrouves: 1, complet: true })).toBe(
      "1 message retrouvé.",
    );
    expect(
      phraseDuRetour({ attendus: 12, retrouves: 9, complet: true }),
    ).toMatch(/^9 messages retrouvés sur 12 ; 3 n'ont pas pu l'être/);
    expect(
      phraseDuRetour({ attendus: 2, retrouves: 0, complet: true }),
    ).toMatch(/^Aucun des 2 messages/);
  });

  it("une lecture qui n'a pas abouti le dit, et dit quoi faire", () => {
    expect(
      phraseDuRetour({ attendus: 5, retrouves: 0, complet: false }),
    ).toMatch(/n'ont pas pu être relus/);
    expect(
      phraseDuRetour({ attendus: 500, retrouves: 300, complet: false }),
    ).toMatch(/^300 messages retrouvés\. La lecture n'est pas terminée/);
  });
});
