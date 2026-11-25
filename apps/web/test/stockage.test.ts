import { describe, expect, it } from "vitest";
import {
  REPERE_STOCKAGE_GO,
  SEUIL_ALERTE_STOCKAGE,
  compte,
  niveauDuStockage,
  nombre,
  octets,
  partDe,
  rapprocherLeBucket,
  resumerLesPieces,
  type LigneDePoids,
} from "@/lib/stockage";

// LA MESURE DU STOCKAGE EST TENUE PAR UN TEST SUR SES RÈGLES PURES (M25.1) :
// les totaux que le backoffice montre, le rapprochement du bucket et de la
// base — c'est lui qui prouve que la file de suppression vide le bucket —, le
// seuil d'alerte, et l'écriture d'un poids.

const ligne = (l: Partial<LigneDePoids>): LigneDePoids => ({
  accountId: "a1",
  canal: "whatsapp",
  famille: "image",
  rattachee: false,
  ignoree: false,
  pieces: 1,
  octets: 100,
  sansTaille: 0,
  ...l,
});

describe("ce qui n'est pas stocké, ou l'est une seule fois", () => {
  it("compte à part les références et ce que la déduplication épargne", () => {
    const r = resumerLesPieces([
      ligne({ pieces: 2, octets: 300, references: 3, octetsAnnonces: 9_000 }),
      ligne({ pieces: 1, octets: 100, partagees: 4, octetsPartages: 400 }),
      ligne({}),
    ]);
    expect(r.total).toEqual({ pieces: 4, octets: 500 });
    expect(r.references).toEqual({ pieces: 3, octets: 9_000 });
    expect(r.partagees).toEqual({ pieces: 4, octets: 400 });
  });
});

describe("résumer les pièces", () => {
  it("additionne par canal, par famille et par compte", () => {
    const r = resumerLesPieces([
      ligne({ famille: "video", pieces: 2, octets: 5000 }),
      ligne({ famille: "image", pieces: 10, octets: 1000 }),
      ligne({ canal: "email", famille: "pdf", pieces: 3, octets: 600 }),
      ligne({ accountId: "a2", canal: "email", famille: "pdf", octets: 50 }),
      ligne({ famille: "audio", octets: 0, sansTaille: 1 }),
    ]);
    expect(r.total).toEqual({ pieces: 17, octets: 6650 });
    expect(r.parCanal.whatsapp).toEqual({ pieces: 13, octets: 6000 });
    expect(r.parCanal.email).toEqual({ pieces: 4, octets: 650 });
    expect(r.parFamille.video).toEqual({ pieces: 2, octets: 5000 });
    expect(r.parFamille.pdf).toEqual({ pieces: 4, octets: 650 });
    expect(r.parCompte).toEqual({
      a1: { pieces: 16, octets: 6600 },
      a2: { pieces: 1, octets: 50 },
    });
    expect(r.sansTaille).toBe(1);
  });

  it("range chaque pièce selon ce qui la tient — un sujet l'emporte sur l'ignorance", () => {
    const r = resumerLesPieces([
      ligne({ rattachee: true, octets: 10 }),
      ligne({ octets: 20 }),
      ligne({ ignoree: true, octets: 30 }),
      // Portée par un sujet dans une conversation ignorée : la purge la laisse.
      ligne({ rattachee: true, ignoree: true, octets: 40 }),
    ]);
    expect(r.tenues).toEqual({ pieces: 2, octets: 50 });
    expect(r.libres).toEqual({ pieces: 1, octets: 20 });
    expect(r.ignorees).toEqual({ pieces: 1, octets: 30 });
    expect(r.tenues.octets + r.libres.octets + r.ignorees.octets).toBe(
      r.total.octets,
    );
  });

  it("rend des zéros sans ligne", () => {
    const r = resumerLesPieces([]);
    expect(r.total).toEqual({ pieces: 0, octets: 0 });
    expect(r.parCompte).toEqual({});
  });
});

describe("rapprocher le bucket de la base", () => {
  const compteDe = (key: string) =>
    key.match(/^accounts\/([^/]+)\//)?.[1] ?? null;
  const luLe = new Date("2026-11-25T08:00:00Z");

  it("ce que la base ne connaît plus et que la file n'attend pas est sans propriétaire", () => {
    const etat = rapprocherLeBucket({
      objets: [
        { key: "accounts/a1/attachments/connue", size: 100 },
        { key: "accounts/a1/attachments/en-file", size: 200 },
        { key: "accounts/a2/attachments/perdue", size: 400 },
        { key: "fixtures/demo.pdf", size: 800 },
      ],
      complet: true,
      connues: [
        "accounts/a1/attachments/connue",
        "accounts/a1/attachments/absente",
      ],
      enAttente: [
        "accounts/a1/attachments/en-file",
        "accounts/a9/attachments/deja-partie",
      ],
      compteDe,
      luLe,
    });
    expect(etat.total).toEqual({ objets: 4, octets: 1500 });
    expect(etat.parCompte).toEqual({
      a1: { objets: 2, octets: 300 },
      a2: { objets: 1, octets: 400 },
    });
    expect(etat.horsComptes).toEqual({ objets: 1, octets: 800 });
    // La clé en file est attendue ; la perdue et l'objet hors convention, non.
    expect(etat.enAttente).toEqual({ objets: 1, octets: 200 });
    expect(etat.sansProprietaire).toEqual({ objets: 2, octets: 1200 });
    // Connue de la base, absente du bucket : une pièce qui ne s'ouvrira pas.
    expect(etat.manquants).toBe(1);
    expect(etat.luLe).toBe("2026-11-25T08:00:00.000Z");
  });

  it("la preuve que la file vide le bucket : tout ce qui est stocké est connu", () => {
    const etat = rapprocherLeBucket({
      objets: [{ key: "accounts/a1/attachments/x", size: 10 }],
      complet: true,
      connues: ["accounts/a1/attachments/x"],
      enAttente: [],
      compteDe,
      luLe,
    });
    expect(etat.sansProprietaire).toEqual({ objets: 0, octets: 0 });
    expect(etat.manquants).toBe(0);
  });

  it("compte le même fichier stocké deux fois dans un compte — pas d'un compte à l'autre", () => {
    const etat = rapprocherLeBucket({
      objets: [
        { key: "accounts/a1/attachments/p1", size: 500, etag: "abc" },
        { key: "accounts/a1/attachments/p2", size: 500, etag: "abc" },
        { key: "accounts/a1/attachments/p3", size: 500, etag: "abc" },
        // Même empreinte, autre compte : chacun garde le sien.
        { key: "accounts/a2/attachments/p4", size: 500, etag: "abc" },
        // Même poids, autre contenu ; et un objet sans empreinte.
        { key: "accounts/a1/attachments/p5", size: 500, etag: "def" },
        { key: "accounts/a1/attachments/p6", size: 500, etag: null },
        { key: "accounts/a1/attachments/p7", size: 500 },
      ],
      complet: true,
      connues: [],
      enAttente: [],
      compteDe,
      luLe,
    });
    expect(etat.doublons).toEqual({ objets: 2, octets: 1000 });
  });

  it("un listing coupé ne dit pas qu'une clé manque", () => {
    const etat = rapprocherLeBucket({
      objets: [{ key: "accounts/a1/attachments/x", size: 10 }],
      complet: false,
      connues: ["accounts/a1/attachments/x", "accounts/a1/attachments/y"],
      enAttente: [],
      compteDe,
      luLe,
    });
    expect(etat.complet).toBe(false);
    expect(etat.manquants).toBe(0);
  });
});

describe("le seuil d'alerte et l'écriture d'un poids", () => {
  const GO = 1024 ** 3;

  it("alerte à partir de quatre cinquièmes du repère, et la jauge ne déborde pas", () => {
    expect(SEUIL_ALERTE_STOCKAGE).toBe(0.8);
    expect(REPERE_STOCKAGE_GO).toBe(10);
    expect(niveauDuStockage(7.9 * GO, 10 * GO)).toMatchObject({
      pct: 79,
      alerte: false,
    });
    expect(niveauDuStockage(8 * GO, 10 * GO)).toMatchObject({
      pct: 80,
      alerte: true,
    });
    expect(niveauDuStockage(14 * GO, 10 * GO)).toMatchObject({
      pct: 100,
      alerte: true,
    });
    expect(niveauDuStockage(5, 0)).toMatchObject({ pct: 0, alerte: false });
  });

  it("écrit un poids dans l'unité qui se lit, avec la virgule française", () => {
    expect(octets(0)).toBe("0");
    expect(octets(512)).toBe("512 o");
    expect(octets(12 * 1024)).toBe("12 Ko");
    expect(octets(3.5 * 1024 ** 2)).toBe("3,5 Mo");
    expect(octets(340 * 1024 ** 2)).toBe("340 Mo");
    expect(octets(7.59 * GO)).toBe("7,59 Go");
    expect(octets(12.34 * GO)).toBe("12,3 Go");
    // Un compte rond se lit sans décimales.
    expect(octets(10 * GO)).toBe("10 Go");
    expect(octets(2 * 1024 ** 2)).toBe("2 Mo");
  });

  it("sépare les milliers d'une espace fine, sans dépendre de la locale", () => {
    expect(nombre(15536)).toBe("15\u202f536");
    expect(nombre(999)).toBe("999");
    expect(nombre(1234567)).toBe("1\u202f234\u202f567");
    expect(compte(1, "fichier", "fichiers")).toBe("1 fichier");
    expect(compte(15536, "fichier", "fichiers")).toBe("15\u202f536 fichiers");
  });

  it("écrit une part en pourcentage entier, et rien sans total", () => {
    expect(partDe(28, 100)).toBe("28 %");
    expect(partDe(1, 3)).toBe("33 %");
    expect(partDe(5, 0)).toBe("—");
  });
});
