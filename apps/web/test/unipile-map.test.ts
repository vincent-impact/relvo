import { describe, expect, it } from "vitest";
import { toOutboundEmail } from "@/server/unipile/map";
import type { UnipileMailWebhook } from "@/server/unipile/types";

// Un `mail_sent` — un e-mail que le dirigeant a envoyé depuis son client de
// messagerie, ou l'écho d'un envoi depuis Relvo — devient une entrée d'envoi :
// l'interlocuteur est le premier To, le set garde To puis Cc, la référence de
// suivi et l'origine traversent pour que le domaine reconnaisse nos envois.

const base: UnipileMailWebhook = {
  event: "mail_sent",
  account_id: "acc",
  email_id: "mail-1",
  from_attendee: { identifier: "moi@tastycrousty.fr", display_name: "Moi" },
  to_attendees: [{ identifier: "karim@sogood.fr", display_name: "Karim" }],
  cc_attendees: [{ identifier: "compta@sogood.fr" }],
  subject: "Re: Rupture sauce blanche",
  body: "<div>OK pour la SB-210</div>",
  body_plain: "OK pour la SB-210",
  date: "2026-10-21T09:00:00.000Z",
  tracking_id: "trk-1",
  origin: "external",
};

describe("toOutboundEmail", () => {
  it("porte les destinataires To puis Cc, la référence de suivi et l'origine", () => {
    const out = toOutboundEmail(base, "11111111-1111-4111-8111-111111111111");
    expect(out.externalId).toBe("mail-1");
    expect(out.trackingId).toBe("trk-1");
    expect(out.origin).toBe("external");
    expect(out.recipients).toEqual(["karim@sogood.fr", "compta@sogood.fr"]);
    expect(out.subjectLine).toBe("Re: Rupture sauce blanche");
    expect(out.content).toBe("OK pour la SB-210");
    expect(out.sentAt?.toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });

  it("tolère un payload sans date valide ni Cc, et coerce `in_reply_to` en chaîne", () => {
    const out = toOutboundEmail(
      {
        ...base,
        cc_attendees: null,
        date: "pas une date",
        in_reply_to: { id: "parent-1" },
      },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(out.recipients).toEqual(["karim@sogood.fr"]);
    expect(out.sentAt).toBeNull();
    expect(out.externalThreadId).toBe("parent-1");
  });
});
