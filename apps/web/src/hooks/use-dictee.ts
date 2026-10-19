"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Enregistreur,
  ErreurEnregistrement,
  type Enregistrement,
  type FluxLike,
  type RecorderLike,
} from "@/lib/dictee-enregistreur";
import {
  PHRASES_DICTEE,
  phraseDictee,
  typeAudioSupporte,
} from "@/lib/dictee-regles";

// LA DICTÉE côté appareil (M22.2, M22.3) — le crochet que le composer de
// l'échange et la page d'essai du backoffice partagent. Trois états : repos,
// enregistre, transcrit. On MAINTIENT le bouton : `appuyer` demande le micro
// (LÀ, jamais au chargement) et enregistre ; on RELÂCHE : `relacher` arrête,
// l'enregistrement part à la route, le texte revient à `onTexte` — et
// l'appelant l'ENVOIE, c'est le geste (revu avec le dirigeant après le
// premier essai : pas de relecture). Un relâcher arrivé pendant que le micro
// s'ouvre est honoré dès qu'il est ouvert. L'écran qui s'éteint, l'app en
// arrière-plan, la piste coupée : c'est un relâcher, ce qui est enregistré se
// transcrit.
//
// L'audio ne vit que dans la mémoire de l'appareil le temps de l'appel ;
// `dernierAudio` le garde pour la feuille de partage de la page d'essai.

export type EtatDictee = "repos" | "enregistre" | "transcrit";

export type MesureDictee = {
  audioSecondes: number;
  dureeMs: number;
  coutEur: number;
  modele: string;
};

const DUREE_MAX_S = 60;
const DUREE_MIN_S = 1;
const TYPES_AUDIO = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

// Le type audio de l'appareil, lu une fois pour toutes : `null` quand il n'y
// a ni micro ni enregistreur. Un instantané stable, comme `useSyncExternalStore`
// l'exige.
let typeAudioLu: string | null | undefined;
function lireTypeAudio(): string | null {
  if (typeAudioLu === undefined) {
    typeAudioLu =
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
        ? null
        : typeAudioSupporte(TYPES_AUDIO, (t) =>
            MediaRecorder.isTypeSupported(t),
          );
  }
  return typeAudioLu;
}
const rienAEcouter = () => () => {};

/** L'enregistreur branché sur le navigateur — hors composant, parce qu'il touche à l'horloge et au micro. */
function enregistreurNavigateur(mimeType: string): Enregistreur {
  return new Enregistreur({
    // Les objets du navigateur satisfont les types injectés par structure ;
    // leurs gestionnaires reçoivent un événement que l'enregistreur ignore.
    demanderMicro: () =>
      navigator.mediaDevices.getUserMedia({ audio: true }) as Promise<FluxLike>,
    creerRecorder: (flux, type) =>
      new MediaRecorder(flux as MediaStream, {
        mimeType: type,
        audioBitsPerSecond: 48_000,
      }) as unknown as RecorderLike,
    mimeType,
    assembler: (morceaux, type) => new Blob(morceaux, { type }),
    maintenant: () => Date.now(),
    planifier: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    dureeMaxS: DUREE_MAX_S,
    dureeMinS: DUREE_MIN_S,
  });
}

export function useDictee({
  onTexte,
}: {
  /** Le texte transcrit — un brouillon à poser dans le champ. */
  onTexte: (texte: string) => void;
}) {
  const [etat, setEtat] = useState<EtatDictee>("repos");
  const [dureeS, setDureeS] = useState(0);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [mesure, setMesure] = useState<MesureDictee | null>(null);
  const [dernierAudio, setDernierAudio] = useState<Enregistrement | null>(null);
  const onTexteRef = useRef(onTexte);
  useEffect(() => {
    onTexteRef.current = onTexte;
  }, [onTexte]);

  // La disponibilité se lit côté client, une fois, sans jamais demander le
  // micro : le serveur ne connaît pas `MediaRecorder` (instantané serveur
  // `undefined`), et le client la lit au premier rendu après l'hydratation.
  const mimeType = useSyncExternalStore(
    rienAEcouter,
    lireTypeAudio,
    () => undefined,
  );

  const enregistreur = useMemo(
    () => (mimeType ? enregistreurNavigateur(mimeType) : null),
    [mimeType],
  );

  // Le compteur, tant qu'on enregistre.
  useEffect(() => {
    if (etat !== "enregistre" || !enregistreur) return;
    const t = setInterval(() => setDureeS(enregistreur.duree()), 250);
    return () => clearInterval(t);
  }, [etat, enregistreur]);

  const transcrire = useCallback(async (e: Enregistrement) => {
    setEtat("transcrit");
    setDernierAudio(e);
    try {
      const form = new FormData();
      form.append(
        "audio",
        e.audio,
        `dictee.${e.mimeType.startsWith("audio/mp4") ? "m4a" : "webm"}`,
      );
      form.append("duree", String(Math.round(e.dureeS * 10) / 10));
      const r = await fetch("/api/relvo/dictee", {
        method: "POST",
        body: form,
      });
      if (r.status === 401) {
        setPhrase("Votre session a expiré. Reconnectez-vous pour dicter.");
        return;
      }
      const j = (await r.json().catch(() => null)) as
        | { texte: string; mesure: MesureDictee }
        | { erreur: string; message?: string }
        | null;
      if (!j || !r.ok) {
        setPhrase(phraseDictee("incompris"));
        return;
      }
      if ("texte" in j) {
        setMesure(j.mesure);
        onTexteRef.current(j.texte);
        return;
      }
      setPhrase(
        phraseDictee(
          j.erreur === "trop-long" ? "trop-long" : "serveur",
          j.message,
        ),
      );
    } catch {
      setPhrase(phraseDictee("reseau"));
    } finally {
      setEtat("repos");
      setDureeS(0);
    }
  }, []);

  const finir = useCallback(
    async (raison: "geste" | "coupe" = "geste") => {
      if (!enregistreur || !enregistreur.enCours) return;
      try {
        const e = await enregistreur.arreter(raison);
        await transcrire(e);
      } catch (err) {
        setEtat("repos");
        setDureeS(0);
        setPhrase(
          phraseDictee(
            err instanceof ErreurEnregistrement && err.code === "permission"
              ? "permission"
              : "trop-court",
          ),
        );
      }
    },
    [enregistreur, transcrire],
  );

  // Le relâcher peut précéder l'ouverture du micro : on le retient.
  const relacheRef = useRef(false);

  /** Le doigt se pose : le micro est demandé, l'enregistrement commence. */
  const appuyer = useCallback(async () => {
    if (!enregistreur || enregistreur.enCours || etat !== "repos") return;
    relacheRef.current = false;
    setPhrase(null);
    setMesure(null);
    try {
      await enregistreur.demarrer();
      setDureeS(0);
      setEtat("enregistre");
      if (relacheRef.current) void finir("geste");
    } catch (err) {
      setEtat("repos");
      setPhrase(
        phraseDictee(
          err instanceof ErreurEnregistrement && err.code === "permission"
            ? "permission"
            : "incompris",
        ),
      );
    }
  }, [enregistreur, etat, finir]);

  /** Le doigt se lève : on arrête, on transcrit, l'appelant envoie. */
  const relacher = useCallback(() => {
    relacheRef.current = true;
    void finir("geste");
  }, [finir]);

  // L'écran qui s'éteint, l'app en arrière-plan : « un appui pour finir ».
  useEffect(() => {
    if (etat !== "enregistre") return;
    const onVisibilite = () => {
      if (document.visibilityState === "hidden") void finir("coupe");
    };
    document.addEventListener("visibilitychange", onVisibilite);
    return () => document.removeEventListener("visibilitychange", onVisibilite);
  }, [etat, finir]);

  // Le composant qui part en plein enregistrement libère le micro.
  useEffect(() => () => enregistreur?.annuler(), [enregistreur]);

  const effacerPhrase = useCallback(() => setPhrase(null), []);

  return {
    /**
     * Faux : pas de micro ni d'enregistreur sur cet appareil — le disque ne
     * s'affiche pas. Vrai tant que la lecture n'a pas eu lieu : le disque est
     * là dès le premier rendu, et ne se retire que si l'appareil ne peut pas.
     */
    disponible: mimeType !== null,
    /** Le crochet est branché sur le micro de l'appareil (lecture faite, type retenu). */
    pret: enregistreur !== null,
    etat,
    dureeS,
    dureeMaxS: DUREE_MAX_S,
    /** La phrase du bandeau (échec, « Relvo écoute… », « Dicté — … »), ou null. */
    phrase: etat === "transcrit" ? PHRASES_DICTEE.ecoute : phrase,
    mesure,
    dernierAudio,
    mimeType: mimeType ?? null,
    appuyer,
    relacher,
    effacerPhrase,
  };
}
