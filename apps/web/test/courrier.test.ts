import { afterEach, describe, expect, it } from "vitest";
import {
  _poserFournisseurPourTest,
  estUnFournisseur,
  fournisseurDe,
} from "@/server/courrier/fournisseur";
import { courrierEmailSender } from "@/server/courrier/envoi";
import type { FournisseurCourrier } from "@/server/courrier/types";
import { courrierDepuisUnipile } from "@/server/unipile/courrier";
import type { UnipileMailWebhook } from "@/server/unipile/types";

// LA FRONTIÈRE DU FOURNISSEUR (M24.1) : le nom gardé en base désigne
// l'implémentation, le port d'envoi du domaine choisit par lui, et l'agrégateur
// fabrique la forme pivot — la nature d'après ce que le courrier EST (#69),
// l'entrée du domaine qui va avec, ses pièces jointes.

function doublure(nom: "unipile" | "gmail"): FournisseurCourrier & {
  envoyes: string[];
} {
  const envoyes: string[] = [];
  return {
    nom,
    envoyes,
    lireRecents: async () => ({ items: [], cursor: null }),
    lirePieceJointe: async () => ({
      bytes: new Uint8Array(),
      contentType: null,
    }),
    envoyer: async (c) => {
      envoyes.push(`${nom}:${c.externalAccountId}`);
      return { emailId: `${nom}-1` };
    },
    etatDuCompte: async () => "connected",
    supprimerCompte: async () => true,
  };
}

afterEach(() => {
  _poserFournisseurPourTest("unipile", null);
  _poserFournisseurPourTest("gmail", null);
});

describe("fournisseurDe", () => {
  it("ne connaît que l'agrégateur et le relais Gmail", () => {
    expect(estUnFournisseur("unipile")).toBe(true);
    expect(estUnFournisseur("gmail")).toBe(true);
    expect(estUnFournisseur("pigeon")).toBe(false);
    expect(estUnFournisseur(null)).toBe(false);
  });

  it("rend l'implémentation du nom gardé en base, l'agrégateur sans configuration", async () => {
    const u = doublure("unipile");
    const g = doublure("gmail");
    _poserFournisseurPourTest("unipile", u);
    _poserFournisseurPourTest("gmail", g);
    expect((await fournisseurDe("gmail")).nom).toBe("gmail");
    expect((await fournisseurDe("unipile")).nom).toBe("unipile");
    // Un canal sans configuration (le jeu de démonstration) : l'agrégateur.
    expect((await fournisseurDe(null)).nom).toBe("unipile");
  });

  it("dit que le relais Gmail n'est pas encore là, sans se taire", async () => {
    await expect(fournisseurDe("gmail")).rejects.toThrow(/relais Gmail/);
  });
});

describe("courrierEmailSender", () => {
  it("fait partir l'e-mail par le fournisseur que le domaine désigne", async () => {
    const u = doublure("unipile");
    const g = doublure("gmail");
    _poserFournisseurPourTest("unipile", u);
    _poserFournisseurPourTest("gmail", g);
    const base = { to: [{ identifier: "a@b.fr" }], subject: "Re:", body: "ok" };
    await courrierEmailSender.sendEmail({
      ...base,
      provider: "gmail",
      externalAccountId: "moi@gmail.com",
    });
    await courrierEmailSender.sendEmail({
      ...base,
      provider: "unipile",
      externalAccountId: "acc_1",
    });
    expect(g.envoyes).toEqual(["gmail:moi@gmail.com"]);
    expect(u.envoyes).toEqual(["unipile:acc_1"]);
  });
});

describe("courrierDepuisUnipile", () => {
  const boite = {
    channelId: "11111111-1111-4111-8111-111111111111",
    nosAdresses: ["moi@tastycrousty.fr"],
  };
  const recu: UnipileMailWebhook = {
    event: "mail_received",
    account_id: "acc",
    email_id: "mail-1",
    role: "inbox",
    from_attendee: { identifier: "karim@sogood.fr", display_name: "Karim" },
    to_attendees: [{ identifier: "moi@tastycrousty.fr" }],
    subject: "Devis",
    body_plain: "Voici le devis",
    date: "2026-10-28T09:00:00.000Z",
    attachments: [{ id: "pj-1", name: "devis.pdf", mime: "application/pdf" }],
  };

  it("un courrier reçu : l'entrée du domaine, sa date, ses pièces jointes", () => {
    const c = courrierDepuisUnipile(recu, boite);
    expect(c.nature).toBe("recu");
    if (c.nature !== "recu") return;
    expect(c.externalId).toBe("mail-1");
    expect(c.date).toBe("2026-10-28T09:00:00.000Z");
    expect(c.entrant.channelId).toBe(boite.channelId);
    expect(c.entrant.senderRaw).toBe("karim@sogood.fr");
    expect(c.pieces).toEqual([
      { id: "pj-1", name: "devis.pdf", mime: "application/pdf", size: null },
    ]);
  });

  it("un brouillon ou un indésirable n'entre pas, et dit pourquoi", () => {
    const b = courrierDepuisUnipile({ ...recu, role: "drafts" }, boite);
    expect(b.nature).toBe("brouillon");
    const e = courrierDepuisUnipile({ ...recu, role: "spam" }, boite);
    expect(e.nature).toBe("ecarte");
    if (e.nature === "ecarte") expect(e.motif).toBe("spam");
  });

  it("un envoi — depuis le dossier des envoyés ou depuis notre adresse — est une sortie", () => {
    const envoye = courrierDepuisUnipile(
      {
        ...recu,
        event: "mail_sent",
        role: "sent",
        from_attendee: { identifier: "moi@tastycrousty.fr" },
        to_attendees: [{ identifier: "karim@sogood.fr" }],
      },
      boite,
    );
    expect(envoye.nature).toBe("envoye");
    if (envoye.nature !== "envoye") return;
    expect(envoye.sortant.recipients).toEqual(["karim@sogood.fr"]);
  });
});
