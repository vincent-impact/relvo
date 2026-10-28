import { describe, expect, it } from "vitest";
import {
  corpsDe,
  courrierDepuisGmail,
  natureDepuisEtiquettes,
} from "@/server/gmail/courrier";
import type { MessageGmail } from "@/server/gmail/api";
import { adresseEtNom, adressesDe, sansFilCite } from "@/server/courrier/corps";

// GMAIL → LA FORME PIVOT (M24.3), sans réseau : la nature d'après les
// étiquettes (#69), l'arbre MIME parcouru, les adresses lues des en-têtes, les
// pièces nommées, la date de la boîte.

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const boite = {
  channelId: "11111111-1111-4111-8111-111111111111",
  nosAdresses: ["moi@tastycrousty.fr", "compte@tastycrousty.fr"],
};

function message(
  labels: string[],
  extra: Partial<MessageGmail> = {},
): MessageGmail {
  return {
    id: "18f3a",
    threadId: "18f00",
    labelIds: labels,
    internalDate: "1793178000000",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "Karim Benali <Karim@SoGood.fr>" },
        {
          name: "To",
          value: 'moi@tastycrousty.fr, "Dupont, Jean" <jean@x.fr>',
        },
        { name: "Cc", value: "<cc@y.fr>" },
        { name: "Subject", value: "Devis cuisine" },
        { name: "Message-ID", value: "<abc@sogood.fr>" },
      ],
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "text/plain",
              body: {
                data: b64(
                  "Voici le devis.\n\n> Le 1 mars 2026 à 10:00, moi a écrit :\n> merci",
                ),
              },
            },
            {
              mimeType: "text/html",
              body: { data: b64("<p>Voici le devis.</p>") },
            },
          ],
        },
        {
          mimeType: "application/pdf",
          filename: "devis.pdf",
          body: { attachmentId: "ANGjdJ8…", size: 12345 },
        },
      ],
    },
    ...extra,
  };
}

describe("natureDepuisEtiquettes", () => {
  it("brouillon, écarté, envoyé — et reçu même de nous dans la boîte de réception", () => {
    expect(
      natureDepuisEtiquettes(["DRAFT", "INBOX"], "x@y.fr", boite.nosAdresses),
    ).toBe("brouillon");
    expect(natureDepuisEtiquettes(["SPAM"], "x@y.fr", boite.nosAdresses)).toBe(
      "ecarte",
    );
    expect(
      natureDepuisEtiquettes(["TRASH", "INBOX"], "x@y.fr", boite.nosAdresses),
    ).toBe("ecarte");
    expect(natureDepuisEtiquettes(["SENT"], "x@y.fr", boite.nosAdresses)).toBe(
      "envoye",
    );
    expect(
      natureDepuisEtiquettes([], "moi@tastycrousty.fr", boite.nosAdresses),
    ).toBe("envoye");
    expect(
      natureDepuisEtiquettes(
        ["INBOX"],
        "moi@tastycrousty.fr",
        boite.nosAdresses,
      ),
    ).toBe("recu");
    expect(
      natureDepuisEtiquettes(
        ["INBOX", "CATEGORY_PROMOTIONS"],
        "x@y.fr",
        boite.nosAdresses,
      ),
    ).toBe("recu");
  });
});

describe("courrierDepuisGmail", () => {
  it("un courrier reçu : l'expéditeur, les destinataires, le corps sans le fil cité, la pièce, le fil", () => {
    const c = courrierDepuisGmail(message(["INBOX", "UNREAD"]), boite);
    expect(c.nature).toBe("recu");
    if (c.nature !== "recu") return;
    expect(c.externalId).toBe("18f3a");
    expect(c.date).toBe("2026-10-28T09:00:00.000Z");
    expect(c.entrant.channelId).toBe(boite.channelId);
    expect(c.entrant.externalThreadId).toBe("18f00");
    expect(c.entrant.senderRaw).toBe("karim@sogood.fr");
    expect(c.entrant.senderName).toBe("Karim Benali");
    expect(c.entrant.recipients).toEqual([
      "moi@tastycrousty.fr",
      "jean@x.fr",
      "cc@y.fr",
    ]);
    expect(c.entrant.subjectLine).toBe("Devis cuisine");
    expect(c.entrant.content).toBe("Voici le devis.");
    // Pas d'image : le HTML « texte déguisé » ne se garde pas.
    expect(c.entrant.contentHtml).toBeNull();
    expect(c.entrant.receivedAt?.toISOString()).toBe(
      "2026-10-28T09:00:00.000Z",
    );
    expect(c.pieces).toEqual([
      {
        id: "ANGjdJ8…",
        name: "devis.pdf",
        mime: "application/pdf",
        size: 12345,
      },
    ]);
    expect(c.entetes?.["message-id"]).toBe("<abc@sogood.fr>");
  });

  it("un envoi depuis Gmail est une sortie d'origine externe, vers To puis Cc", () => {
    const c = courrierDepuisGmail(
      message(["SENT"], {
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "moi@tastycrousty.fr" },
            { name: "To", value: "karim@sogood.fr" },
            { name: "Subject", value: "Re: Devis cuisine" },
          ],
          body: { data: b64("OK pour le devis.") },
        },
      }),
      boite,
    );
    expect(c.nature).toBe("envoye");
    if (c.nature !== "envoye") return;
    expect(c.sortant.recipients).toEqual(["karim@sogood.fr"]);
    expect(c.sortant.origin).toBe("external");
    expect(c.sortant.content).toBe("OK pour le devis.");
    expect(c.pieces).toEqual([]);
  });

  it("un brouillon ou un indésirable n'entre pas, et dit l'étiquette", () => {
    const b = courrierDepuisGmail(message(["DRAFT"]), boite);
    expect(b.nature).toBe("brouillon");
    const e = courrierDepuisGmail(message(["SPAM", "INBOX"]), boite);
    expect(e.nature).toBe("ecarte");
    if (e.nature === "ecarte") expect(e.motif).toBe("SPAM");
  });

  it("sans date interne, la date vient de l'en-tête ; sans en-tête, null", () => {
    const sans = message(["INBOX"], { internalDate: undefined });
    sans.payload!.headers!.push({
      name: "Date",
      value: "Tue, 28 Oct 2026 10:00:00 +0100",
    });
    expect(courrierDepuisGmail(sans, boite).date).toBe(
      "2026-10-28T09:00:00.000Z",
    );
    const rien = message(["INBOX"], { internalDate: undefined });
    expect(courrierDepuisGmail(rien, boite).date).toBeNull();
  });
});

describe("corpsDe", () => {
  it("un message simple en HTML seul : le texte vient du HTML, l'image le garde fidèle", () => {
    const html =
      '<div>Bonjour<img src="x.png"><blockquote>vieux</blockquote></div>';
    const corps = corpsDe({ mimeType: "text/html", body: { data: b64(html) } });
    expect(corps.plain).toBeNull();
    expect(corps.html).toBe(html);
    expect(corps.pieces).toEqual([]);
  });
});

describe("l'hygiène des adresses", () => {
  it("lit nom et adresse, en minuscules, et sépare une ligne To en respectant les guillemets", () => {
    expect(adresseEtNom('"Benali, Karim" <Karim@SoGood.fr>')).toEqual({
      adresse: "karim@sogood.fr",
      nom: "Benali, Karim",
    });
    expect(adresseEtNom("karim@sogood.fr")).toEqual({
      adresse: "karim@sogood.fr",
      nom: null,
    });
    expect(adressesDe('"Dupont, Jean" <jean@x.fr>, a@b.fr , <c@d.fr>')).toEqual(
      ["jean@x.fr", "a@b.fr", "c@d.fr"],
    );
    expect(sansFilCite("Merci\n\n> cité")).toBe("Merci");
  });
});

describe("requeteDeLecture", () => {
  it("la boîte de réception depuis la date, sans indésirable ni corbeille, en secondes", async () => {
    const { requeteDeLecture } = await import("@/server/gmail/courrier");
    expect(requeteDeLecture(new Date("2026-10-14T09:00:00.000Z"))).toBe(
      "in:inbox -in:spam -in:trash after:1791968400",
    );
  });
});
