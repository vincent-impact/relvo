import { NextResponse } from "next/server";
import { isAssistantEnabled, tenantDb } from "@relvo/db";
import { getCurrentAccountId } from "@/server/auth-context";
import { DICTEE, inferenceDisponible } from "@/server/ia";
import { transcrireDictee } from "@/server/ia/dictee";
import { PHRASES } from "@/server/ia/echange/tour";
import { PHRASES_DICTEE } from "@/lib/dictee-regles";

// La route de la dictée (M22.3) — un enregistrement entre, un texte sort, à
// poser dans le composer. Session vérifiée ici (`/api` est hors du proxy, #30),
// l'identifiant du compte vient de la session, jamais du corps (invariant 1).
// Les gardes dans l'ordre : inférence configurée, assistant actif, taille,
// durée — et chaque refus est une PHRASE en langage client, jamais une
// erreur HTTP nue : l'appelant est le composer, et il l'affiche telle quelle.
//
// Le corps est un `multipart/form-data` : `audio` (le fichier tel que
// l'appareil l'a enregistré) et `duree` (secondes, mesurées par l'appareil).
// L'audio n'est ni conservé ni journalisé : il traverse, c'est tout.

export const maxDuration = 60;

type Reponse =
  | {
      texte: string;
      mesure: {
        audioSecondes: number;
        dureeMs: number;
        coutEur: number;
        modele: string;
      };
    }
  | {
      erreur: "indisponible" | "desactive" | "incompris" | "trop-long";
      message: string;
    };

function refus(
  erreur: Exclude<Reponse, { texte: string }>["erreur"],
  message: string,
) {
  return NextResponse.json({ erreur, message } satisfies Reponse);
}

export async function POST(request: Request) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  if (!inferenceDisponible())
    return refus("indisponible", PHRASES.indisponible);
  if (!(await isAssistantEnabled(tenantDb(accountId), accountId))) {
    return refus("desactive", PHRASES.desactive);
  }

  // La taille est bornée AVANT de lire le corps : un enregistrement au-delà
  // du plafond n'est pas chargé en mémoire pour être refusé ensuite.
  const taille = Number(request.headers.get("content-length") ?? 0);
  if (taille > DICTEE.tailleMaxOctets + 4_096) {
    return refus("trop-long", PHRASES_DICTEE.tropLong);
  }

  let audio: File | null = null;
  let dureeS = 0;
  try {
    const form = await request.formData();
    const f = form.get("audio");
    audio = f instanceof File ? f : null;
    dureeS = Number(form.get("duree") ?? 0);
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }
  if (!audio || !Number.isFinite(dureeS) || dureeS < 0) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (audio.size > DICTEE.tailleMaxOctets || dureeS > DICTEE.dureeMaxS) {
    return refus("trop-long", PHRASES_DICTEE.tropLong);
  }

  const issue = await transcrireDictee({
    accountId,
    audio: new Uint8Array(await audio.arrayBuffer()),
    dureeS,
  });
  if (!issue.ok) {
    return refus(
      issue.erreur,
      issue.erreur === "trop-long"
        ? PHRASES_DICTEE.tropLong
        : PHRASES_DICTEE.incompris,
    );
  }
  return NextResponse.json({
    texte: issue.texte,
    mesure: {
      audioSecondes: issue.mesure.audioSecondes ?? dureeS,
      dureeMs: issue.mesure.dureeMs,
      coutEur: issue.mesure.cout.eur,
      modele: issue.mesure.modele,
    },
  } satisfies Reponse);
}
