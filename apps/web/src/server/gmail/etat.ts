import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { RetourConnexion } from "@/server/courrier/retour";

// L'ÉTAT d'un consentement en cours (M24.2) : ce qu'on retrouve au retour de
// Google — quel canal, quelle page de retour, quelle boîte s'il s'agit d'une
// reconnexion — et le NONCE qui prouve que ce retour répond bien à un départ
// de ce navigateur (le `state` d'OAuth). Un cookie de session, HttpOnly, dix
// minutes : il part avec le navigateur, jamais avec l'URL.

const COOKIE = "relvo.gmail";
const DUREE_S = 10 * 60;

export type EtatConnexion = {
  nonce: string;
  channelId: string;
  retour: RetourConnexion;
  /** La boîte attendue quand on reconnecte : une autre adresse est refusée. */
  adresse?: string;
};

export async function poserEtat(
  etat: Omit<EtatConnexion, "nonce">,
): Promise<string> {
  const nonce = randomBytes(16).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ ...etat, nonce } satisfies EtatConnexion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/gmail/retour",
    maxAge: DUREE_S,
  });
  return nonce;
}

/** Relit et EFFACE l'état ; `null` si le `state` ne répond à aucun départ de ce navigateur. */
export async function reprendreEtat(
  state: string | null,
): Promise<EtatConnexion | null> {
  const jar = await cookies();
  const brut = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: "/api/gmail/retour" });
  if (!brut || !state) return null;
  const etat = lireEtat(brut);
  if (!etat || etat.nonce !== state) return null;
  return etat;
}

export function lireEtat(brut: string): EtatConnexion | null {
  try {
    const v = JSON.parse(brut) as Partial<EtatConnexion>;
    if (
      typeof v.nonce !== "string" ||
      typeof v.channelId !== "string" ||
      (v.retour !== "canaux" && v.retour !== "relvo")
    ) {
      return null;
    }
    return {
      nonce: v.nonce,
      channelId: v.channelId,
      retour: v.retour,
      ...(typeof v.adresse === "string" ? { adresse: v.adresse } : {}),
    };
  } catch {
    return null;
  }
}
