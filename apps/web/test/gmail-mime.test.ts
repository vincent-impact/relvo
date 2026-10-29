import { describe, expect, it } from "vitest";
import {
  construireMime,
  destinataire,
  motEncode,
  rawPourGmail,
} from "@/server/gmail/mime";
import { htmlDepuisTexte } from "@/server/courrier/corps";

// L'ENVOI (M24.5), sans réseau : le message MIME construit à la main — les
// en-têtes, l'encodage des accents, le fil, les deux corps relisibles.

describe("construireMime", () => {
  const mime = construireMime({
    de: "moi@tastycrousty.fr",
    a: [
      { identifier: "karim@sogood.fr", display_name: "Karim Benali" },
      { identifier: "sophie@x.fr", display_name: "Sophie Léger" },
    ],
    objet: "Re: Devis cuisine — validé",
    texte: "Bien noté,\nje valide.\n\tMerci",
    html: htmlDepuisTexte("Bien noté,\nje valide.\n\tMerci"),
    enReponseA: {
      messageId: "<abc@sogood.fr>",
      references: "<racine@sogood.fr>",
    },
    date: new Date("2026-10-29T09:00:00.000Z"),
    frontiere: "frontiere-test",
  });
  const lignes = mime.split("\r\n");

  it("porte les en-têtes, le fil, et encode ce qui sort de l'ASCII", () => {
    expect(lignes[0]).toBe("From: moi@tastycrousty.fr");
    expect(lignes[1]).toBe('To: "Karim Benali" <karim@sogood.fr>,');
    expect(lignes[2]).toBe(" =?UTF-8?B?U29waGllIEzDqWdlcg==?= <sophie@x.fr>");
    expect(lignes[3]).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/);
    expect(
      Buffer.from(
        lignes[3]!.slice("Subject: =?UTF-8?B?".length, -2),
        "base64",
      ).toString(),
    ).toBe("Re: Devis cuisine — validé");
    expect(lignes).toContain("Date: Thu, 29 Oct 2026 09:00:00 GMT");
    expect(lignes).toContain("In-Reply-To: <abc@sogood.fr>");
    expect(lignes).toContain("References: <racine@sogood.fr> <abc@sogood.fr>");
    expect(lignes).toContain(
      'Content-Type: multipart/alternative; boundary="frontiere-test"',
    );
    expect(mime.endsWith("--frontiere-test--\r\n")).toBe(true);
  });

  it("les deux corps se relisent, et aucune ligne ne dépasse ce qu'un serveur tolère", () => {
    const parties = mime.split("--frontiere-test").slice(1, 3);
    const corps = parties.map((p) => {
      const [, b64] = p.split("\r\n\r\n");
      return Buffer.from(b64!.replace(/\r\n/g, ""), "base64").toString("utf8");
    });
    expect(corps[0]).toBe("Bien noté,\nje valide.\n\tMerci");
    expect(corps[1]).toBe(
      '<div style="white-space:pre-wrap">Bien noté,<br>je valide.<br>&nbsp;&nbsp;&nbsp;&nbsp;Merci</div>',
    );
    expect(parties[0]).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(parties[1]).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(lignes.every((l) => l.length <= 998)).toBe(true);
    const corpsB64 = mime.split("\r\n\r\n").slice(2).join("\r\n").split("\r\n");
    expect(
      corpsB64.filter((l) => !l.startsWith("--")).every((l) => l.length <= 76),
    ).toBe(true);
  });

  it("sans message auquel répondre, pas de fil ; l'ASCII reste lisible", () => {
    const seul = construireMime({
      de: "moi@x.fr",
      a: [{ identifier: "a@b.fr" }],
      objet: "Hello",
      texte: "ok",
      html: "<p>ok</p>",
      frontiere: "f",
    });
    expect(seul).not.toContain("In-Reply-To");
    expect(seul).toContain("Subject: Hello\r\n");
    expect(seul).toContain("To: a@b.fr\r\n");
    expect(rawPourGmail("ab")).toBe("YWI");
    expect(motEncode("plain")).toBe("plain");
    expect(
      destinataire({ identifier: "a@b.fr", display_name: 'Jean "JD" Dupont' }),
    ).toBe('"Jean JD Dupont" <a@b.fr>');
  });
});
