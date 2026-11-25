import { beforeEach, describe, expect, it, vi } from "vitest";

// LA RÉPONSE AU DIRIGEANT (M29.7), côté fournisseur. Ce que ce fichier tient :
// d'où vient le message cité (le webhook s'il le dit, sinon une relecture chez
// l'agrégateur — et jamais les deux), et à quoi l'on reconnaît que c'est le
// dirigeant qu'on cite (un envoi que Relvo a vu partir, ou « c'est moi » dans
// l'annuaire). Les formes sont celles relues sur de vrais messages de groupe.

const doubles = vi.hoisted(() => ({
  estUnEnvoiDuDirigeant: vi.fn(),
  annuaireDesMentions: vi.fn(),
  noterIdentites: vi.fn(),
  getChatMessage: vi.fn(),
  listChatAttendees: vi.fn(),
}));

vi.mock("@relvo/db", async () => {
  // Les fonctions pures du domaine, les vraies ; ce qui lit la base, doublé.
  const reel =
    await import("../../../packages/db/src/domain/annuaire-messagerie");
  return {
    cleIdentite: reel.cleIdentite,
    idsDesMentions: reel.idsDesMentions,
    mentionneLeDirigeant: reel.mentionneLeDirigeant,
    estUnEnvoiDuDirigeant: doubles.estUnEnvoiDuDirigeant,
    annuaireDesMentions: doubles.annuaireDesMentions,
    noterIdentites: doubles.noterIdentites,
  };
});
vi.mock("@/server/unipile", () => ({
  getChatMessage: doubles.getChatMessage,
  listChatAttendees: doubles.listChatAttendees,
}));

import { reponseAuDirigeant } from "@/server/annuaire-messagerie";

const MOI = "190000000000001";
const EYA = "265338952376336";
const db = {} as never;
const base = {
  channelId: "canal",
  chatId: "chat-equipe",
  messageExternalId: "msg-1",
};
const annuaire = (...moi: string[]) =>
  new Map(moi.map((id) => [id, { name: null, phone: null, isSelf: true }]));

beforeEach(() => {
  vi.clearAllMocks();
  doubles.estUnEnvoiDuDirigeant.mockResolvedValue(false);
  doubles.annuaireDesMentions.mockResolvedValue(new Map());
  doubles.listChatAttendees.mockResolvedValue([]);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("ce message répond-il au dirigeant ?", () => {
  it("le webhook dit ce qui est cité : un envoi que Relvo a vu partir suffit, sans relire l'agrégateur", async () => {
    doubles.estUnEnvoiDuDirigeant.mockResolvedValue(true);
    expect(
      await reponseAuDirigeant(db, {
        ...base,
        quoted: {
          message_id: "envoi-7",
          sender_id: `${MOI}@lid`,
          text: "7 h sur place",
        },
      }),
    ).toBe("7 h sur place");
    expect(doubles.estUnEnvoiDuDirigeant).toHaveBeenCalledWith(db, "envoi-7");
    expect(doubles.getChatMessage).not.toHaveBeenCalled();
    expect(doubles.annuaireDesMentions).not.toHaveBeenCalled();
  });

  it("le webhook n'en dit rien : le message est relu, et l'auteur cité reconnu par l'annuaire", async () => {
    doubles.getChatMessage.mockResolvedValue({
      id: "msg-1",
      quoted: { message_id: "vieux", sender_id: `${MOI}@lid`, text: null },
    });
    doubles.annuaireDesMentions.mockResolvedValue(annuaire(MOI));
    // Le message cité n'avait pas de texte : une réponse quand même, extrait vide.
    expect(await reponseAuDirigeant(db, { ...base, quoted: undefined })).toBe(
      "",
    );
    expect(doubles.getChatMessage).toHaveBeenCalledWith("msg-1");
    expect(doubles.annuaireDesMentions).toHaveBeenCalledWith(db, [MOI], {
      channelId: "canal",
    });
  });

  it("le webhook dit qu'il ne cite rien : ni relecture, ni réponse", async () => {
    expect(await reponseAuDirigeant(db, { ...base, quoted: null })).toBeNull();
    expect(doubles.getChatMessage).not.toHaveBeenCalled();
  });

  it("on cite quelqu'un d'autre, ou rien : ce n'est pas une réponse au dirigeant", async () => {
    doubles.annuaireDesMentions.mockResolvedValue(
      new Map([[EYA, { name: "Dahmani Eya", phone: null, isSelf: false }]]),
    );
    expect(
      await reponseAuDirigeant(db, {
        ...base,
        quoted: { message_id: "x", sender_id: `${EYA}@lid`, text: "Ok" },
      }),
    ).toBeNull();
    doubles.getChatMessage.mockResolvedValue({ id: "msg-1" });
    expect(
      await reponseAuDirigeant(db, { ...base, quoted: undefined }),
    ).toBeNull();
  });

  it("un auteur inconnu de l'annuaire : les participants du fil sont demandés une fois — c'est là qu'on apprend « c'est moi »", async () => {
    doubles.annuaireDesMentions
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(annuaire(MOI));
    doubles.listChatAttendees.mockResolvedValue([
      { provider_id: `${MOI}@lid`, name: "Moi", is_self: 1 },
    ]);
    expect(
      await reponseAuDirigeant(db, {
        ...base,
        quoted: { sender_id: `${MOI}@lid`, text: "Qui passe demain ?" },
      }),
    ).toBe("Qui passe demain ?");
    expect(doubles.listChatAttendees).toHaveBeenCalledTimes(1);
    expect(doubles.noterIdentites).toHaveBeenCalledTimes(1);
  });

  it("un agrégateur muet laisse le message sans mention, il ne l'empêche pas d'entrer", async () => {
    doubles.getChatMessage.mockRejectedValue(new Error("503"));
    expect(
      await reponseAuDirigeant(db, { ...base, quoted: undefined }),
    ).toBeNull();
  });
});
