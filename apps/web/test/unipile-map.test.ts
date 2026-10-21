import { describe, expect, it } from "vitest";
import {
  doitRelireEmail,
  natureDuCourrier,
  toOutboundEmail,
} from "@/server/unipile/map";
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

// La nature d'un courrier ne se lit pas dans l'événement seul : Gmail pousse
// chaque enregistrement de brouillon en « reçu ».
describe("natureDuCourrier", () => {
  const nous = ["moi@tastycrousty.fr", "Contact@TastyCrousty.fr"];
  it("un brouillon est un brouillon, quel que soit l'événement", () => {
    expect(
      natureDuCourrier(
        { ...base, event: "mail_received", role: "drafts" },
        nous,
      ),
    ).toBe("brouillon");
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: null,
          folders: ["[Gmail]/Brouillons"],
        },
        nous,
      ),
    ).toBe("brouillon");
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: "unknown",
          folders: ["Drafts"],
        },
        nous,
      ),
    ).toBe("brouillon");
  });
  it("l'indésirable et la corbeille sont écartés", () => {
    expect(
      natureDuCourrier({ ...base, event: "mail_received", role: "spam" }, nous),
    ).toBe("ecarte");
    expect(
      natureDuCourrier(
        { ...base, event: "mail_received", role: "trash" },
        nous,
      ),
    ).toBe("ecarte");
  });
  it("un envoi se reconnaît à l'événement, au dossier, ou à notre adresse hors boîte de réception", () => {
    expect(
      natureDuCourrier({ ...base, event: "mail_sent", role: null }, nous),
    ).toBe("envoye");
    expect(
      natureDuCourrier({ ...base, event: "mail_received", role: "sent" }, nous),
    ).toBe("envoye");
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: "unknown",
          from_attendee: { identifier: "contact@tastycrousty.fr" },
        },
        nous,
      ),
    ).toBe("envoye");
  });
  it("un courrier reçu reste reçu — même de nous-mêmes dans la boîte de réception", () => {
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: "inbox",
          from_attendee: { identifier: "karim@sogood.fr" },
        },
        nous,
      ),
    ).toBe("recu");
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: "inbox",
          from_attendee: { identifier: "moi@tastycrousty.fr" },
        },
        nous,
      ),
    ).toBe("recu");
    expect(
      natureDuCourrier(
        {
          ...base,
          event: "mail_received",
          role: null,
          from_attendee: { identifier: "karim@sogood.fr" },
        },
        nous,
      ),
    ).toBe("recu");
  });
});

describe("doitRelireEmail — la ligne de liste suffit-elle ?", () => {
  it("relit sans corps, relit quand des pièces sont annoncées sans être listées, sinon garde la ligne", () => {
    expect(
      doitRelireEmail({ kind: "1_meta", body: null, body_plain: null }),
    ).toBe(true);
    expect(
      doitRelireEmail({
        kind: "1_meta",
        body_plain: "Bonjour",
        has_attachments: false,
      }),
    ).toBe(false);
    expect(
      doitRelireEmail({
        kind: "1_meta",
        body_plain: "Devis ci-joint",
        has_attachments: true,
        attachments: [],
      }),
    ).toBe(true);
    expect(
      doitRelireEmail({
        kind: "2_full",
        body: "<p>ok</p>",
        has_attachments: true,
        attachments: [],
      }),
    ).toBe(true);
    expect(
      doitRelireEmail({
        kind: "2_full",
        body: "<p>ok</p>",
        has_attachments: true,
        attachments: [{ id: "a1", name: "devis.pdf" }],
      }),
    ).toBe(false);
  });
});
