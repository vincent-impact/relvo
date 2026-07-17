import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  createMessage,
  createSubject,
  deleteChannel,
  prisma,
  tenantDb,
} from "../src/index";

// Suppression d'un canal (M5, Réglages → Canaux) — HARD-DELETE assumé :
//   1. le canal et ses messages partent (FK messages.channel_id en CASCADE) ;
//   2. les sujets rattachés SURVIVENT (source_channel_id en SetNull) ;
//   3. l'externalAccountId est renvoyé pour déconnecter le compte Unipile.

describe("deleteChannel (M5)", () => {
  it("supprime le canal + ses messages, préserve les sujets, renvoie l'externalAccountId", async () => {
    const account = await prisma.account.create({
      data: { email: "del@test.fr", firstName: "Test", lastName: "User" },
    });
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Gmail",
        type: "email",
        identifier: "del@test.fr",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: account.id,
        channelId: channel.id,
        provider: "unipile",
        externalAccountId: "acc_del_xyz",
        status: "connected",
      },
    });
    const db = tenantDb(account.id);
    const subject = await createSubject(db, {
      title: "Sujet rattaché",
      contactIds: [],
      createdByActor: "user",
    });
    const message = await createMessage(db, {
      channelId: channel.id,
      direction: MessageDirection.incoming,
      subjectId: subject.id,
      senderRaw: "karim@sogood.fr",
      content: "Bonjour",
      status: "linked",
    });

    const res = await deleteChannel(db, channel.id);

    expect(res.externalAccountId).toBe("acc_del_xyz");
    expect(await db.channel.count({ where: { id: channel.id } })).toBe(0);
    // Message cascadé.
    expect(await db.message.count({ where: { id: message.id } })).toBe(0);
    // Config cascadée.
    expect(
      await prisma.channelConfig.count({ where: { channelId: channel.id } }),
    ).toBe(0);
    // Le sujet survit à la suppression du canal.
    expect(await db.subject.count({ where: { id: subject.id } })).toBe(1);
  });
});
