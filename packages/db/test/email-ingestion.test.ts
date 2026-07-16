import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  ingestInboundEmail,
  prisma,
  tenantDb,
} from "../src/index";

// Ingestion email entrante (M5) — deux garanties qui portent tout le flux :
//   1. un email reçu devient un Message ORPHELIN (« Sans sujet ») ;
//   2. un webhook rejoué (même channelId + externalId) ne crée pas de doublon.
// Le mapper payload→entrée est testé côté apps/web (fonction pure) ; ici on
// vérifie le comportement en base, invérifiable en mock (contrainte unique).

async function makeAccountWithChannel(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: "email",
      identifier: email,
    },
  });
  return { account, channel, db: tenantDb(account.id) };
}

describe("ingestInboundEmail (M5)", () => {
  it("crée un Message orphelin (« Sans sujet »)", async () => {
    const { channel, db } = await makeAccountWithChannel("in@test.fr");

    const { message, created } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "unipile-email-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
      content: "Bonjour, la livraison arrive jeudi.",
    });

    expect(created).toBe(true);
    expect(message.subjectId).toBeNull();
    expect(message.direction).toBe(MessageDirection.incoming);
    expect(message.status).toBe(MessageStatus.received);
    expect(message.externalId).toBe("unipile-email-1");
    expect(message.senderRaw).toBe("karim@sogood.fr");
    expect(message.receivedAt).not.toBeNull();
  });

  it("est idempotent : un webhook rejoué ne duplique pas le message", async () => {
    const { channel, db } = await makeAccountWithChannel("dup@test.fr");
    const input = {
      channelId: channel.id,
      externalId: "unipile-email-2",
      subjectLine: "Relance",
      content: "Rappel",
    };

    const first = await ingestInboundEmail(db, input);
    const second = await ingestInboundEmail(db, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.message.id).toBe(first.message.id);
    expect(await db.message.count()).toBe(1);
  });

  it("isole par canal : même externalId sur deux canaux = deux messages", async () => {
    const { account, channel, db } =
      await makeAccountWithChannel("iso@test.fr");
    const channel2 = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte 2",
        type: "email",
        identifier: "iso2@test.fr",
      },
    });

    await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "shared-id",
      content: "A",
    });
    const second = await ingestInboundEmail(db, {
      channelId: channel2.id,
      externalId: "shared-id",
      content: "B",
    });

    expect(second.created).toBe(true);
    expect(await db.message.count()).toBe(2);
  });
});
