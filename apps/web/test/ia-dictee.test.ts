import { describe, expect, it, vi } from "vitest";
import { MockTranscriptionModelV4 } from "ai/test";
import {
  DICTEE,
  EchecSollicitation,
  estEchoDuPrompt,
  transcrire,
} from "@/server/ia";
import {
  PLAFOND_PROMPT_DICTEE,
  promptDictee,
} from "@/server/ia/dictee/vocabulaire";
import {
  Enregistreur,
  ErreurEnregistrement,
  type FluxLike,
  type PisteLike,
  type RecorderLike,
} from "@/lib/dictee-enregistreur";
import {
  formatDuree,
  PHRASES_DICTEE,
  phraseDictee,
  typeAudioSupporte,
} from "@/lib/dictee-regles";

// LA DICTÉE EST TENUE PAR UN TEST (M22) — sans base, sans micro, sans modèle :
// ce que le tier « transcription » garantit (tarif avant l'appel, refus à zéro
// seconde, mesure en secondes d'audio, texte vide = échec avec sa mesure) ;
// ce que le prompt du vocabulaire contient et combien il pèse ; ce que
// l'enregistreur fait du micro (demandé au geste, libéré à l'arrêt, plafond,
// piste coupée, trop court) ; et les règles du composer (ajout au texte,
// phrases du geste maintenir-relâcher).

function modeleSimule(text: string, durationInSeconds?: number) {
  const doGenerate = vi.fn(async () => ({
    text,
    segments: [],
    language: "fr",
    durationInSeconds,
    warnings: [],
    response: { timestamp: new Date(), modelId: "simule", headers: {} },
  }));
  return {
    modele: new MockTranscriptionModelV4({ modelId: "simule", doGenerate }),
    doGenerate,
  };
}

// Un conteneur MP4 de carton : le SDK lit le type dans les octets (`ftyp`).
const audio = new Uint8Array(2_000);
audio.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 0);

describe("tier transcription — transcrire()", () => {
  it("rend le texte, la durée du fournisseur et le prompt du vocabulaire atteint le fournisseur", async () => {
    const { modele, doGenerate } = modeleSimule(
      "  Rappelle Karim Benali demain.  ",
      7.4,
    );
    const { sortie, mesure } = await transcrire({
      sollicitation: "dictee",
      audio,
      dureeS: 8,
      prompt: "Contacts : Karim Benali (ClimaPro).",
      modele,
    });
    expect(sortie).toBe("Rappelle Karim Benali demain.");
    expect(mesure.tier).toBe("transcription");
    expect(mesure.sollicitation).toBe("dictee");
    expect(mesure.audioSecondes).toBe(7.4);
    expect(mesure.niveau).toBe("none");
    expect(mesure.jetons.sortie).toBe(0);
    const appel = (doGenerate.mock.calls as unknown as unknown[][])[0]![0] as {
      mediaType: string;
      providerOptions?: { openai?: { language?: string; prompt?: string } };
    };
    expect(appel.mediaType).toBe("audio/mp4");
    expect(appel.providerOptions?.openai?.language).toBe("fr");
    expect(appel.providerOptions?.openai?.prompt).toContain("Karim Benali");
  });

  it("se replie sur la durée de l'appareil quand le fournisseur ne rend pas la sienne", async () => {
    const { modele } = modeleSimule("Bonjour.");
    const { mesure } = await transcrire({
      sollicitation: "dictee",
      audio,
      dureeS: 3.2,
      modele,
    });
    expect(mesure.audioSecondes).toBe(3.2);
  });

  it("refuse AVANT l'appel une dictée au-delà de la durée ou de la taille maximale, à zéro seconde", async () => {
    const { modele, doGenerate } = modeleSimule("x");
    const tropLongue = await transcrire({
      sollicitation: "dictee",
      audio,
      dureeS: DICTEE.dureeMaxS + 1,
      modele,
    }).catch((e) => e);
    expect(tropLongue).toBeInstanceOf(EchecSollicitation);
    expect((tropLongue as EchecSollicitation).motif).toBe("audio-trop-long");
    expect((tropLongue as EchecSollicitation).mesure).toBeNull();

    const tropLourde = await transcrire({
      sollicitation: "dictee",
      audio: new Uint8Array(DICTEE.tailleMaxOctets + 1),
      dureeS: 5,
      modele,
    }).catch((e) => e);
    expect((tropLourde as EchecSollicitation).motif).toBe("audio-trop-long");
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("un texte qui recopie le prompt (silence, bruit) est un échec « audio-vide », jamais un brouillon", async () => {
    const prompt =
      "Dictée en français de Mam's Crousty, restauration. Contacts : Karim Benali (ClimaPro).";
    const { modele } = modeleSimule("Dictée en français de Mam's Crousty.", 6);
    const err = await transcrire({
      sollicitation: "dictee",
      audio,
      dureeS: 6,
      prompt,
      modele,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EchecSollicitation);
    expect((err as EchecSollicitation).motif).toBe("audio-vide");
    expect((err as EchecSollicitation).mesure?.audioSecondes).toBe(6);
    expect(estEchoDuPrompt("Karim Benali", prompt)).toBe(true);
    expect(estEchoDuPrompt("Rappelle Karim Benali demain.", prompt)).toBe(
      false,
    );
    expect(estEchoDuPrompt("Dictée en français de X.", undefined)).toBe(false);
  });

  it("un texte vide est un échec nommé qui porte sa mesure — la dictée a coûté ses secondes", async () => {
    const { modele } = modeleSimule("   ", 4);
    const err = await transcrire({
      sollicitation: "dictee",
      audio,
      dureeS: 4,
      modele,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EchecSollicitation);
    expect((err as EchecSollicitation).motif).toBe("audio-vide");
    expect((err as EchecSollicitation).mesure?.audioSecondes).toBe(4);
  });
});

describe("le vocabulaire du compte — promptDictee()", () => {
  const vocabulaire = {
    dirigeant: "Mam's Crousty",
    secteurs: ["food" as const],
    contacts: [
      { prenom: "Karim", nom: "Benali", entreprise: "ClimaPro" },
      { prenom: null, nom: "Blanchard", entreprise: null },
    ],
    affaires: ["Panne chambre froide", "Devis extracteur"],
  };

  it("porte le cadre, les noms, les affaires et les mots du secteur, dans cet ordre", () => {
    const p = promptDictee(vocabulaire);
    expect(
      p.startsWith("Dictée en français de Mam's Crousty, restauration."),
    ).toBe(true);
    expect(p).toContain("Contacts : Karim Benali (ClimaPro), Blanchard.");
    expect(p).toContain("Affaires : Panne chambre froide, Devis extracteur.");
    expect(p).toContain("Mots : DLC");
    expect(p.indexOf("Contacts")).toBeLessThan(p.indexOf("Affaires"));
    expect(p.indexOf("Affaires")).toBeLessThan(p.indexOf("Mots"));
    expect(promptDictee(vocabulaire)).toBe(p);
  });

  it("tient dans le plafond avec une fixture pire que la réalité, sans couper un nom", () => {
    const p = promptDictee({
      dirigeant: "Un Dirigeant Au Nom Très Long De Famille",
      secteurs: ["food", "construction"],
      contacts: Array.from({ length: 200 }, (_, i) => ({
        prenom: `Prénom${i}`,
        nom: `Nom-De-Famille-Composé-${i}`,
        entreprise: `Entreprise Numéro ${i} SARL`,
      })),
      affaires: Array.from(
        { length: 100 },
        (_, i) => `Affaire numéro ${i} avec un titre long`,
      ),
    });
    expect(p.length).toBeLessThanOrEqual(PLAFOND_PROMPT_DICTEE);
    expect(p).toContain(
      "Contacts : Prénom0 Nom-De-Famille-Composé-0 (Entreprise Numéro 0 SARL)",
    );
    // Chaque liste finit par un nom entier, jamais par un mot coupé.
    expect(p).toMatch(/\.$/);
    expect(p).not.toContain(", .");
  });

  it("sans contact ni affaire, le cadre et les mots du secteur suffisent", () => {
    const p = promptDictee({
      dirigeant: "",
      secteurs: ["construction"],
      contacts: [],
      affaires: [],
    });
    expect(p).toBe(
      `Dictée en français, bâtiment. Mots : ${p.slice(p.indexOf("Mots : ") + 7)}`,
    );
    expect(p).toContain("DPGF");
  });
});

// Un navigateur de carton : flux, piste, recorder, horloge, minuteur.
function appareil(options: { refuser?: boolean; differe?: boolean } = {}) {
  let t = 0;
  const minuteurs: { fn: () => void; a: number }[] = [];
  let stopDiffere: (() => void) | null = null;
  const piste: PisteLike & { arrets: number } = {
    arrets: 0,
    onended: null,
    stop() {
      this.arrets += 1;
    },
  };
  const flux: FluxLike = { getTracks: () => [piste] };
  let recorder: (RecorderLike & { demarre: boolean; arrete: boolean }) | null =
    null;
  const deps = {
    demanderMicro: vi.fn(async () => {
      if (options.refuser)
        throw new DOMException("Permission denied", "NotAllowedError");
      return flux;
    }),
    creerRecorder: (_f: FluxLike, mimeType: string) => {
      recorder = {
        mimeType,
        demarre: false,
        arrete: false,
        ondataavailable: null,
        onstop: null,
        onerror: null,
        start() {
          this.demarre = true;
        },
        stop() {
          this.arrete = true;
          const finir = () => {
            this.ondataavailable?.({ data: "morceau" });
            this.onstop?.();
          };
          if (options.differe) stopDiffere = finir;
          else finir();
        },
      };
      return recorder;
    },
    mimeType: "audio/mp4",
    assembler: (morceaux: BlobPart[], mimeType: string) =>
      ({ morceaux, type: mimeType, size: morceaux.length }) as unknown as Blob,
    maintenant: () => t,
    planifier: (fn: () => void, ms: number) => {
      const m = { fn, a: t + ms };
      minuteurs.push(m);
      return () => {
        const i = minuteurs.indexOf(m);
        if (i >= 0) minuteurs.splice(i, 1);
      };
    },
    dureeMaxS: 60,
    dureeMinS: 1,
  };
  return {
    deps,
    piste,
    recorder: () => recorder!,
    /** Le navigateur finit d'arrêter (mode `differe`). */
    terminerStop() {
      stopDiffere?.();
      stopDiffere = null;
    },
    avancer(ms: number) {
      t += ms;
      for (const m of [...minuteurs]) {
        if (m.a <= t) {
          minuteurs.splice(minuteurs.indexOf(m), 1);
          m.fn();
        }
      }
    },
  };
}

describe("l'enregistreur — le micro au geste, libéré à l'arrêt", () => {
  it("demande le micro au geste, enregistre, et rend l'audio avec sa durée à l'arrêt", async () => {
    const a = appareil();
    const e = new Enregistreur(a.deps);
    expect(a.deps.demanderMicro).not.toHaveBeenCalled();
    await e.demarrer();
    expect(a.deps.demanderMicro).toHaveBeenCalledTimes(1);
    expect(a.recorder().demarre).toBe(true);
    a.avancer(7_500);
    expect(e.duree()).toBe(7.5);
    const fin = await e.arreter();
    expect(fin.dureeS).toBe(7.5);
    expect(fin.mimeType).toBe("audio/mp4");
    expect(fin.raison).toBe("geste");
    expect(a.piste.arrets).toBe(1);
    expect(e.enCours).toBe(false);
  });

  it("arrêter deux fois pendant l'arrêt ne rend qu'un résultat", async () => {
    const a = appareil({ differe: true });
    const e = new Enregistreur(a.deps);
    await e.demarrer();
    a.avancer(5_000);
    const p1 = e.arreter("geste");
    const p2 = e.arreter("plafond");
    expect(a.recorder().arrete).toBe(true);
    a.terminerStop();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
    expect(r1.raison).toBe("geste");
    expect(a.piste.arrets).toBe(1);
    // Au repos, arrêter est une erreur de programmation, pas un résultat.
    await expect(e.arreter()).rejects.toBeInstanceOf(ErreurEnregistrement);
  });

  it("s'arrête seul au plafond, et libère la piste", async () => {
    const a = appareil();
    const e = new Enregistreur(a.deps);
    await e.demarrer();
    a.avancer(60_000);
    expect(a.recorder().arrete).toBe(true);
    expect(e.enCours).toBe(false);
    expect(a.piste.arrets).toBe(1);
  });

  it("la piste coupée (écran éteint) vaut « un appui pour finir »", async () => {
    const a = appareil();
    const e = new Enregistreur(a.deps);
    await e.demarrer();
    a.avancer(4_000);
    a.piste.onended?.();
    expect(a.recorder().arrete).toBe(true);
    expect(e.enCours).toBe(false);
    expect(a.piste.arrets).toBe(1);
  });

  it("sous une seconde, rien n'est rendu — et la piste est libérée quand même", async () => {
    const a = appareil();
    const e = new Enregistreur(a.deps);
    await e.demarrer();
    a.avancer(400);
    const err = await e.arreter().catch((x) => x);
    expect(err).toBeInstanceOf(ErreurEnregistrement);
    expect((err as ErreurEnregistrement).code).toBe("trop-court");
    expect(a.piste.arrets).toBe(1);
  });

  it("la durée est celle du geste, pas celle de la fermeture du conteneur par le navigateur", async () => {
    const a = appareil({ differe: true });
    const e = new Enregistreur(a.deps);
    await e.demarrer();
    a.avancer(400);
    const fin = e.arreter("geste");
    // Le navigateur met deux secondes à rendre l'événement `stop` : ce n'est
    // pas de la dictée — un appui de 0,4 s reste trop court.
    a.avancer(2_000);
    a.terminerStop();
    const err = await fin.catch((x) => x);
    expect((err as ErreurEnregistrement).code).toBe("trop-court");

    const b = appareil({ differe: true });
    const f = new Enregistreur(b.deps);
    await f.demarrer();
    b.avancer(3_000);
    const fin2 = f.arreter("geste");
    b.avancer(2_000);
    b.terminerStop();
    expect((await fin2).dureeS).toBe(3);
  });

  it("un micro refusé est une erreur de permission, rien n'est enregistré", async () => {
    const a = appareil({ refuser: true });
    const e = new Enregistreur(a.deps);
    const err = await e.demarrer().catch((x) => x);
    expect((err as ErreurEnregistrement).code).toBe("permission");
    expect(e.enCours).toBe(false);
  });
});

describe("les règles du composer", () => {
  it("dit la phrase tranchée pour chaque échec, et laisse passer celle de la route", () => {
    expect(phraseDictee("incompris")).toBe("Je n'ai pas compris. Réessayez.");
    expect(phraseDictee("permission")).toBe(PHRASES_DICTEE.permission);
    expect(phraseDictee("trop-court")).toBe(PHRASES_DICTEE.maintenir);
    expect(
      phraseDictee(
        "serveur",
        "L'assistant est désactivé dans vos préférences.",
      ),
    ).toBe("L'assistant est désactivé dans vos préférences.");
    expect(phraseDictee("serveur", "")).toBe(PHRASES_DICTEE.incompris);
  });

  it("retient le premier type audio que l'appareil accepte, ou rien", () => {
    expect(
      typeAudioSupporte(["audio/mp4", "audio/webm"], (t) => t === "audio/webm"),
    ).toBe("audio/webm");
    expect(typeAudioSupporte(["audio/mp4"], () => false)).toBeNull();
    expect(
      typeAudioSupporte(["audio/mp4"], () => {
        throw new TypeError("isTypeSupported is not a function");
      }),
    ).toBeNull();
  });

  it("formate le compteur en mm:ss", () => {
    expect(formatDuree(0)).toBe("0:00");
    expect(formatDuree(7.9)).toBe("0:07");
    expect(formatDuree(60)).toBe("1:00");
  });
});
