import { NextResponse } from "next/server";
import { APERCU_MAX_OCTETS, lireClasseur } from "@relvo/storage/classeur";
import { estUnClasseur } from "@relvo/storage/fichiers";
import { phraseSansApercu, type ApercuPiece } from "@/lib/pieces";
import {
  fileSizeInStorage,
  readFile,
  signedRedirectHeaders,
  statutDuRefus,
  type Resolution,
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

function refus(error: StorageAccessError) {
  return NextResponse.json(
    { error: "Fichier introuvable." },
    { status: statutDuRefus(error) },
  );
}

/**
 * Le refus d'une pièce quand c'est le NAVIGATEUR qui la demandait — un PDF
 * ouvert dans un onglet, un téléchargement : une page qui le dit, pas du JSON
 * sur fond blanc. Ne sert que pour une référence qu'on n'a pas pu aller
 * chercher (M25.3) ; tout autre refus garde sa réponse.
 */
export function pageDeRefus(resolution: Resolution, request: Request) {
  if (resolution.ok || !resolution.piece) return null;
  const echec =
    ECHEC_DE_SOURCE[resolution.error as keyof typeof ECHEC_DE_SOURCE];
  if (!echec) return null;
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return null;
  const propre = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${propre(resolution.piece.name)}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,system-ui,sans-serif"><main style="max-width:300px;padding:28px;text-align:center"><p style="margin:0 0 12px;font-size:18px;font-weight:500;overflow-wrap:anywhere">${propre(resolution.piece.name)}</p><p style="margin:0;font-size:14px;line-height:20px;opacity:.65">${propre(phraseSansApercu("autre", echec))}</p></main></body></html>`;
  return new Response(html, {
    status: statutDuRefus(resolution.error),
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

/** Ce que l'écran dira d'une référence qu'on n'a pas pu aller chercher (M25.3). */
const ECHEC_DE_SOURCE = {
  plus_servie: "plus_servie",
  trop_lourde: "trop_lourde_pour_relvo",
  source_muette: "source_muette",
} as const;

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
  if (!resolution.ok) {
    // Une référence qu'on n'a pas pu aller chercher reste une pièce qu'on
    // connaît : l'écran montre son nom, son poids, et dit pourquoi.
    const echec =
      resolution.piece &&
      ECHEC_DE_SOURCE[resolution.error as keyof typeof ECHEC_DE_SOURCE];
    if (!echec || !resolution.piece) return refus(resolution.error);
    const apercu: ApercuPiece = {
      nom: resolution.piece.name,
      mimeType: resolution.piece.mimeType,
      taille: resolution.piece.size,
      classeur: null,
      echec,
    };
    return NextResponse.json(apercu, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
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
