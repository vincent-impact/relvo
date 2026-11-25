import { describe, expect, it } from "vitest";
import {
  MEDIAS,
  VIGNETTE_MAX_CARACTERES,
  adresseDeVignette,
  deciderDeLaPiece,
  estUneImageIncorporee,
  familleDeMedia,
} from "@/lib/medias";
import { corpsDe } from "@/server/gmail/courrier";
import { pieceDepuisUnipile } from "@/server/unipile/courrier";
import { piecesDuMessage, vignetteDepuisOriginal } from "@/server/unipile/map";

// LA POLITIQUE DES MÉDIAS EST TENUE PAR UN TEST SUR SES RÈGLES PURES (M25.3,
// M25.5) — « décider avant de télécharger » : ce que Relvo fait d'une pièce de
// messagerie avant d'en lire un octet, ce qu'il lit de la description de
// l'agrégateur, et ce qu'il laisse d'un e-mail.

const MO = 1024 * 1024;
const photo = {
  famille: "image" as const,
  taille: 200_000,
  autocollant: false,
  gif: false,
  vocal: false,
};

describe("décider d'une pièce de messagerie", () => {
  it("une photo ne se stocke que si un sujet porte le message", () => {
    expect(deciderDeLaPiece(photo, { porteeParUnSujet: true })).toBe("stocker");
    expect(deciderDeLaPiece(photo, { porteeParUnSujet: false })).toBe(
      "reference",
    );
  });

  it("une vidéo hors sujet n'est jamais téléchargée", () => {
    const video = { ...photo, famille: "video" as const, taille: 30 * MO };
    expect(deciderDeLaPiece(video, { porteeParUnSujet: false })).toBe(
      "reference",
    );
    expect(deciderDeLaPiece(video, { porteeParUnSujet: true })).toBe("stocker");
  });

  it("au-delà du plafond de sa famille, même portée par un sujet, elle reste une référence", () => {
    for (const famille of ["image", "audio", "video", "autre"] as const) {
      const lourde = {
        ...photo,
        famille,
        taille: MEDIAS.plafonds[famille] + 1,
      };
      expect(deciderDeLaPiece(lourde, { porteeParUnSujet: true })).toBe(
        "reference",
      );
      const juste = { ...lourde, taille: MEDIAS.plafonds[famille] };
      expect(deciderDeLaPiece(juste, { porteeParUnSujet: true })).toBe(
        "stocker",
      );
    }
  });

  it("un autocollant ou un GIF n'est qu'une trace, sujet ou pas", () => {
    for (const porteeParUnSujet of [true, false]) {
      expect(
        deciderDeLaPiece({ ...photo, autocollant: true }, { porteeParUnSujet }),
      ).toBe("trace");
      expect(
        deciderDeLaPiece(
          { ...photo, famille: "video", gif: true },
          { porteeParUnSujet },
        ),
      ).toBe("trace");
    }
  });

  it("un vocal se garde sans sujet, sous son plafond", () => {
    const vocal = { ...photo, famille: "audio" as const, vocal: true };
    expect(deciderDeLaPiece(vocal, { porteeParUnSujet: false })).toBe(
      "stocker",
    );
    expect(
      deciderDeLaPiece(
        { ...vocal, taille: MEDIAS.plafonds.audio + 1 },
        { porteeParUnSujet: false },
      ),
    ).toBe("reference");
    // Un fichier son n'est pas un vocal : il suit la règle commune.
    expect(
      deciderDeLaPiece({ ...vocal, vocal: false }, { porteeParUnSujet: false }),
    ).toBe("reference");
  });

  it("un poids inconnu ne retient pas la pièce qu'un sujet porte", () => {
    expect(
      deciderDeLaPiece({ ...photo, taille: null }, { porteeParUnSujet: true }),
    ).toBe("stocker");
  });

  it("range un type MIME dans sa famille", () => {
    expect(familleDeMedia("video/mp4")).toBe("video");
    expect(familleDeMedia("IMAGE/JPEG")).toBe("image");
    expect(familleDeMedia("audio/ogg; codecs=opus")).toBe("audio");
    expect(familleDeMedia("application/pdf")).toBe("autre");
    expect(familleDeMedia(null)).toBe("autre");
  });
});

// La vignette telle que le réseau la joint : un JPEG en base64.
const VIGNETTE = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4q";

describe("lire ce que l'agrégateur dit d'un message", () => {
  it("trouve la vignette où qu'elle soit dans le message brut", () => {
    const image = JSON.stringify({
      key: { id: "A" },
      message: {
        imageMessage: { mimetype: "image/jpeg", jpegThumbnail: VIGNETTE },
      },
    });
    expect(vignetteDepuisOriginal(image)).toBe(VIGNETTE);
    const ephemere = {
      message: {
        ephemeralMessage: {
          message: { videoMessage: { jpegThumbnail: VIGNETTE } },
        },
      },
    };
    expect(vignetteDepuisOriginal(ephemere)).toBe(VIGNETTE);
  });

  it("ne rend rien d'un brut illisible, d'une vignette qui n'est pas un JPEG ou trop lourde", () => {
    expect(vignetteDepuisOriginal("pas du json")).toBeNull();
    expect(vignetteDepuisOriginal(null)).toBeNull();
    expect(vignetteDepuisOriginal({ message: { text: "bonjour" } })).toBeNull();
    expect(
      vignetteDepuisOriginal({ m: { jpegThumbnail: "iVBORw0KGgo=" } }),
    ).toBeNull();
    expect(
      vignetteDepuisOriginal({
        m: { jpegThumbnail: "/9j/" + "A".repeat(VIGNETTE_MAX_CARACTERES) },
      }),
    ).toBeNull();
    expect(
      vignetteDepuisOriginal({ m: { jpegThumbnail: '/9j/"><script>' } }),
    ).toBeNull();
  });

  it("décrit une photo, une vidéo, un vocal, un document", () => {
    const [p] = piecesDuMessage({
      id: "m1",
      original: JSON.stringify({
        message: { imageMessage: { jpegThumbnail: VIGNETTE } },
      }),
      attachments: [
        {
          id: "a1",
          type: "img",
          file_size: 75_360,
          mimetype: "image/jpeg",
          sticker: false,
        },
      ],
    });
    expect(p).toEqual({
      id: "a1",
      famille: "image",
      mime: "image/jpeg",
      nom: "photo",
      taille: 75_360,
      autocollant: false,
      gif: false,
      vocal: false,
      vignette: VIGNETTE,
    });

    const [v] = piecesDuMessage({
      id: "m2",
      attachments: [
        { id: "a2", type: "video", file_size: 4_455_888, gif: false },
      ],
    });
    expect(v).toMatchObject({
      famille: "video",
      mime: "video/mp4",
      nom: "vidéo",
      vignette: null,
    });

    const [vocal] = piecesDuMessage({
      id: "m3",
      attachments: [
        {
          id: "a3",
          type: "audio",
          voice_note: true,
          mimetype: "audio/ogg; codecs=opus",
        },
      ],
    });
    expect(vocal).toMatchObject({
      famille: "audio",
      vocal: true,
      nom: "message vocal",
      taille: null,
    });

    const [doc] = piecesDuMessage({
      id: "m4",
      original: JSON.stringify({
        message: { documentMessage: { jpegThumbnail: VIGNETTE } },
      }),
      attachments: [
        {
          id: "a4",
          type: "file",
          file_name: "Devis 1234.pdf",
          mimetype: "application/pdf",
          file_size: 300_000,
        },
      ],
    });
    // Un document garde son nom ; la vignette n'est que pour ce qui se regarde.
    expect(doc).toMatchObject({
      famille: "autre",
      nom: "Devis 1234.pdf",
      mime: "application/pdf",
      vignette: null,
    });
  });

  it("reconnaît un autocollant et un GIF, sans leur donner de vignette", () => {
    const [s] = piecesDuMessage({
      id: "m5",
      original: JSON.stringify({
        message: { stickerMessage: { jpegThumbnail: VIGNETTE } },
      }),
      attachments: [
        { id: "a5", type: "img", sticker: true, mimetype: "image/webp" },
      ],
    });
    expect(s).toMatchObject({
      autocollant: true,
      nom: "autocollant",
      vignette: null,
    });
    const [g] = piecesDuMessage({
      id: "m6",
      attachments: [{ id: "a6", type: "video", gif: true }],
    });
    expect(g).toMatchObject({ gif: true, nom: "GIF" });
  });

  it("un fichier dont le type dit « vidéo » est une vidéo", () => {
    const [f] = piecesDuMessage({
      id: "m7",
      attachments: [
        {
          id: "a7",
          type: "file",
          mimetype: "video/quicktime",
          file_name: "chantier.mov",
        },
      ],
    });
    expect(f).toMatchObject({ famille: "video", nom: "chantier.mov" });
  });

  it("sans message relu, se rabat sur ce que le webhook portait", () => {
    const pieces = piecesDuMessage(null, [
      {
        attachment_id: "w1",
        attachment_type: "video",
        attachment_size: 9_000_000,
      },
      { attachment_id: "w2", attachment_type: "file" },
    ]);
    expect(pieces).toEqual([
      {
        id: "w1",
        famille: "video",
        mime: "video/mp4",
        nom: "vidéo",
        taille: 9_000_000,
        autocollant: false,
        gif: false,
        vocal: false,
        vignette: null,
      },
      {
        id: "w2",
        famille: "autre",
        mime: null,
        nom: "piece-jointe",
        taille: null,
        autocollant: false,
        gif: false,
        vocal: false,
        vignette: null,
      },
    ]);
    // Une vidéo connue du seul webhook reste donc une référence hors sujet.
    expect(deciderDeLaPiece(pieces[0]!, { porteeParUnSujet: false })).toBe(
      "reference",
    );
  });

  it("écrit l'adresse d'une vignette", () => {
    expect(adresseDeVignette(VIGNETTE)).toBe(
      `data:image/jpeg;base64,${VIGNETTE}`,
    );
    expect(adresseDeVignette(null)).toBeNull();
  });
});

describe("les images incorporées d'un e-mail", () => {
  it("un logo de signature n'est pas une pièce jointe", () => {
    expect(
      estUneImageIncorporee({
        mime: "image/png",
        size: 8_000,
        incorporee: true,
      }),
    ).toBe(true);
    // Le poids non dit ne profite pas au logo.
    expect(
      estUneImageIncorporee({
        mime: "image/png",
        size: null,
        incorporee: true,
      }),
    ).toBe(true);
  });

  it("une image jointe, une image collée lourde et un PDF se gardent", () => {
    expect(
      estUneImageIncorporee({
        mime: "image/jpeg",
        size: 8_000,
        incorporee: false,
      }),
    ).toBe(false);
    expect(estUneImageIncorporee({ mime: "image/jpeg", size: 8_000 })).toBe(
      false,
    );
    expect(
      estUneImageIncorporee({
        mime: "image/jpeg",
        size: MEDIAS.incorporeeMaxOctets + 1,
        incorporee: true,
      }),
    ).toBe(false);
    expect(
      estUneImageIncorporee({
        mime: "application/pdf",
        size: 500,
        incorporee: true,
      }),
    ).toBe(false);
  });

  it("l'agrégateur et Gmail disent tous deux qu'une pièce est incorporée", () => {
    expect(
      pieceDepuisUnipile({
        id: "1",
        name: "logo.png",
        mime: "image/png",
        size: 900,
        cid: "ii_abc",
      }).incorporee,
    ).toBe(true);
    expect(
      pieceDepuisUnipile({
        id: "2",
        name: "devis.pdf",
        mime: "application/pdf",
      }).incorporee,
    ).toBe(false);

    const corps = corpsDe({
      mimeType: "multipart/related",
      parts: [
        {
          mimeType: "image/png",
          filename: "logo.png",
          headers: [{ name: "Content-ID", value: "<ii_abc>" }],
          body: { attachmentId: "g1", size: 900 },
        },
        {
          mimeType: "application/pdf",
          filename: "devis.pdf",
          headers: [{ name: "Content-Disposition", value: "attachment" }],
          body: { attachmentId: "g2", size: 40_000 },
        },
      ],
    });
    expect(corps.pieces.map((p) => [p.name, p.incorporee])).toEqual([
      ["logo.png", true],
      ["devis.pdf", false],
    ]);
  });
});
