import "server-only";
import {
  getDictationVocabulary,
  logAiFailure,
  logAiSolicitation,
  tenantDb,
} from "@relvo/db";
import { EchecSollicitation, transcrire } from "../client";
import { DICTEE } from "../config";
import type { MesureSollicitation } from "../tarifs";
import { promptDictee } from "./vocabulaire";

// UNE DICTÉE (M22.3) — ce que la route fait d'un enregistrement du dirigeant :
// le vocabulaire du compte assemblé (M22.4), la transcription par le tier
// dédié, la mesure consignée — une ligne de journal par dictée, les secondes
// d'audio en métadonnée (M22.1) —, et un ÉCHEC consigné comme un tour de
// l'échange en échec. Le texte rendu est un BROUILLON : c'est l'appareil qui
// le pose dans le composer, jamais cette fonction qui l'envoie. L'audio ne vit
// que le temps de l'appel : rien n'est écrit ni en base ni dans le stockage.
//
// M20.1 (dicter un message à un contact) appellera cette même fonction.

export { promptDictee } from "./vocabulaire";

export type IssueDictee =
  | { ok: true; texte: string; mesure: MesureSollicitation }
  | { ok: false; erreur: "incompris" | "trop-long" };

export async function transcrireDictee(args: {
  accountId: string;
  audio: Uint8Array;
  /** Durée mesurée par l'appareil, en secondes. */
  dureeS: number;
}): Promise<IssueDictee> {
  const db = tenantDb(args.accountId);
  if (args.dureeS < DICTEE.dureeMinS) return { ok: false, erreur: "incompris" };
  const vocabulaire = await getDictationVocabulary(db, args.accountId);
  try {
    const { sortie, mesure } = await transcrire({
      sollicitation: "dictee",
      audio: args.audio,
      dureeS: args.dureeS,
      prompt: promptDictee(vocabulaire),
    });
    await logAiSolicitation(db, mesure);
    return { ok: true, texte: sortie, mesure };
  } catch (err) {
    if (err instanceof EchecSollicitation) {
      // Une dictée qui a coûté ses secondes sans rien rendre se consigne
      // comme les autres ; une dictée refusée avant l'appel n'a rien coûté.
      if (err.mesure) await logAiSolicitation(db, err.mesure);
      await consignerEchec(args.accountId, err.motif, err.message);
      return {
        ok: false,
        erreur: err.motif === "audio-trop-long" ? "trop-long" : "incompris",
      };
    }
    await consignerEchec(
      args.accountId,
      "inconnu",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}

async function consignerEchec(
  accountId: string,
  motif: string,
  detail: string,
) {
  try {
    await logAiFailure(tenantDb(accountId), {
      sollicitation: "dictee",
      motif,
      detail: detail.slice(0, 500),
      tier: "transcription",
    });
  } catch (e) {
    console.error("[ia] dictee — échec non consigné", e);
  }
}
