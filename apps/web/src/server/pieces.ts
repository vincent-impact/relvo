import { NextResponse } from "next/server";
import { APERCU_MAX_OCTETS, lireClasseur } from "@relvo/storage/classeur";
import { estUnClasseur } from "@relvo/storage/fichiers";
import type { ApercuPiece } from "@/lib/pieces";
import {
  fileSizeInStorage,
  readFile,
  signedRedirectHeaders,
  type ResolvedFile,
  type StorageAccessError,
} from "@/server/storage-access";

// Ce que l'application LIT d'une pièce (recette R18) : son aperçu et ses octets.
//
// Une image ou un PDF s'affiche par redirection vers le stockage (`/download`).
// Un classeur, lui, ne se rend pas dans un navigateur, et « Ouvrir avec… » a
// besoin du fichier EN MAIN, dans la page. Le stockage n'autorise aucune
// lecture depuis une autre origine (aucune règle CORS sur le bucket,
// `PITFALLS.md` #77) : les deux passent donc par ici.
//
//   /apercu  → du JSON : l'identité du fichier et, pour un classeur, ses
//              premières lignes. Le serveur lit le fichier ENTIER dans le
//              stockage (sans plafond de réponse) et n'envoie que l'aperçu,
//              borné — un classeur de 6 Mo se lit donc sans peine.
//   /contenu → les octets, pour le partage. C'est une DÉROGATION, bornée, à
//              « jamais de fichier servi par une fonction » (`PITFALLS.md` #11) :
//              la réponse d'une fonction plafonne à 4,5 Mo, on s'arrête à 4.
//              Au-delà, 413 — l'écran le dit et garde « Télécharger ».

/** Sous le plafond de 4,5 Mo d'une réponse de fonction, en-têtes compris. */
export const CONTENU_MAX_OCTETS = 4 * 1024 * 1024;

type Resolution =
  | { ok: true; file: ResolvedFile }
  | { ok: false; error: StorageAccessError };

function refus(error: StorageAccessError) {
  return NextResponse.json(
    { error: "Fichier introuvable." },
    { status: error === "unauthenticated" ? 401 : 404 },
  );
}

/** L'aperçu d'un fichier résolu. Ne lève pas : un échec est une donnée. */
export async function apercuDePiece(file: ResolvedFile): Promise<ApercuPiece> {
  const base = { nom: file.name, mimeType: file.mimeType };

  if (!estUnClasseur(file.name, file.mimeType)) {
    const taille = file.size ?? (await fileSizeInStorage(file));
    return {
      ...base,
      taille,
      classeur: null,
      echec: taille === null ? "absent" : null,
    };
  }

  const lu = await readFile(file, APERCU_MAX_OCTETS);
  if (lu.status === "absent") {
    return { ...base, taille: file.size, classeur: null, echec: "absent" };
  }
  if (lu.status === "trop_lourd") {
    return { ...base, taille: lu.size, classeur: null, echec: "trop_lourd" };
  }
  const lecture = lireClasseur(lu.body, base);
  return lecture.ok
    ? { ...base, taille: lu.size, classeur: lecture.classeur, echec: null }
    : { ...base, taille: lu.size, classeur: null, echec: lecture.raison };
}

export async function repondreApercu(resolution: Resolution) {
  if (!resolution.ok) return refus(resolution.error);
  return NextResponse.json(await apercuDePiece(resolution.file), {
    headers: signedRedirectHeaders(),
  });
}

export async function repondreContenu(resolution: Resolution) {
  if (!resolution.ok) return refus(resolution.error);

  const lu = await readFile(resolution.file, CONTENU_MAX_OCTETS);
  if (lu.status === "absent") return refus("not_found");
  if (lu.status === "trop_lourd") {
    return NextResponse.json(
      { error: "Fichier trop lourd pour être lu par l'application." },
      { status: 413, headers: signedRedirectHeaders() },
    );
  }

  // ⚠️ Un fichier reçu de l'extérieur, servi depuis NOTRE origine : il ne doit
  // jamais pouvoir s'y exécuter. Type opaque, téléchargement imposé, pas de
  // devinette — la page lui redonne son vrai type en le prenant en main.
  return new Response(lu.body as BodyInit, {
    headers: {
      ...signedRedirectHeaders(),
      "Content-Type": "application/octet-stream",
      "Content-Length": String(lu.size),
      "Content-Disposition": "attachment",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
