// `@relvo/db/erreurs` et non `@relvo/db` : l'index instancie le client Prisma
// à l'import, et ce module se teste sans base.
import { DomainError } from "@relvo/db/erreurs";

// Le CONSENTEMENT Google du relais (M24.2), sans SDK : le point d'entrée OAuth
// et les échanges de jetons s'appellent en `fetch`. Le client est celui du
// projet Google Cloud de l'organisation (`GMAIL_CLIENT_ID`, jamais
// `AUTH_GOOGLE_*`, qui allumerait la connexion Google à l'application).

const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETON = "https://oauth2.googleapis.com/token";
const REVOCATION = "https://oauth2.googleapis.com/revoke";
const PROFIL = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * Les périmètres demandés, et rien d'autre : lire, envoyer, l'adresse. Les deux
 * premiers sont « restreints » chez Google — c'est ce qui déclenche la
 * vérification (M24.7). Ni modification ni suppression, jamais.
 */
export const PERIMETRES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export function gmailConfigure(): boolean {
  return !!process.env.GMAIL_CLIENT_ID && !!process.env.GMAIL_CLIENT_SECRET;
}

function client(): { id: string; secret: string } {
  const id = process.env.GMAIL_CLIENT_ID;
  const secret = process.env.GMAIL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new DomainError(
      "INVALID_STATE",
      "Le relais Gmail n'est pas configuré (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).",
    );
  }
  return { id, secret };
}

/** L'adresse de retour déclarée chez Google : celle de l'application, `/api/gmail/retour`. */
export function adresseDeRetour(): string {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gmail/retour`;
}

/**
 * L'URL du consentement. `access_type=offline` et `prompt=consent` : c'est
 * ainsi que Google rend un jeton de rafraîchissement, à chaque fois — une
 * reconnexion en a besoin autant qu'une première connexion. `login_hint`
 * présélectionne la boîte qu'on reconnecte.
 */
export function urlDeConsentement(input: {
  state: string;
  loginHint?: string | null;
}): string {
  const url = new URL(AUTORISATION);
  url.searchParams.set("client_id", client().id);
  url.searchParams.set("redirect_uri", adresseDeRetour());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PERIMETRES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

export type JetonsGoogle = {
  acces: string;
  rafraichissement: string;
  /** Instant où le jeton d'accès cesse de valoir. */
  expireA: Date;
  /** Les périmètres effectivement accordés — Google les laisse décocher un à un. */
  perimetres: string[];
};

type ReponseJeton = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function demanderJeton(
  corps: Record<string, string>,
  maintenant: () => Date = () => new Date(),
): Promise<ReponseJeton & { expireA: Date }> {
  const res = await fetch(JETON, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corps).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as ReponseJeton;
  if (!res.ok || !json.access_token) {
    console.error("[gmail] jeton refusé", {
      status: res.status,
      error: json.error,
      description: json.error_description,
    });
    throw new DomainError(
      "INVALID_STATE",
      json.error === "invalid_grant"
        ? "Google ne reconnaît plus l'accès à cette boîte : reconnectez-la."
        : "Google n'a pas répondu. Réessayez dans un instant.",
      { details: { google: json.error ?? res.status } },
    );
  }
  return {
    ...json,
    expireA: new Date(
      maintenant().getTime() + (json.expires_in ?? 3600) * 1000,
    ),
  };
}

/** Le code du retour contre les jetons de la boîte. Sans jeton de rafraîchissement, rien ne tiendrait sept jours : refusé. */
export async function echangerLeCode(code: string): Promise<JetonsGoogle> {
  const { id, secret } = client();
  const j = await demanderJeton({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: adresseDeRetour(),
    grant_type: "authorization_code",
  });
  if (!j.refresh_token) {
    throw new DomainError(
      "INVALID_STATE",
      "Google n'a pas donné d'accès durable à la boîte. Réessayez en acceptant le consentement.",
    );
  }
  return {
    acces: j.access_token!,
    rafraichissement: j.refresh_token,
    expireA: j.expireA,
    perimetres: perimetresDe(j.scope),
  };
}

/** Un nouveau jeton d'accès depuis le jeton de rafraîchissement (le même jeton de rafraîchissement reste bon). */
export async function rafraichirLAcces(
  rafraichissement: string,
): Promise<{ acces: string; expireA: Date }> {
  const { id, secret } = client();
  const j = await demanderJeton({
    refresh_token: rafraichissement,
    client_id: id,
    client_secret: secret,
    grant_type: "refresh_token",
  });
  return { acces: j.access_token!, expireA: j.expireA };
}

/** Révoque l'accès que la boîte nous avait donné (suppression du canal). Best-effort : `true` si Google a dit oui. */
export async function revoquer(jeton: string): Promise<boolean> {
  try {
    const res = await fetch(REVOCATION, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: jeton }).toString(),
    });
    return res.ok;
  } catch (err) {
    console.error("[gmail] révocation impossible", err);
    return false;
  }
}

/** L'adresse de la boîte derrière un jeton d'accès — en minuscules, c'est l'identifiant externe du canal. */
export async function adresseDuJeton(acces: string): Promise<string> {
  const res = await fetch(PROFIL, {
    headers: { authorization: `Bearer ${acces}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    email?: string;
    email_verified?: boolean;
  };
  if (!res.ok || !json.email) {
    throw new DomainError(
      "INVALID_STATE",
      "Google n'a pas dit l'adresse de la boîte. Réessayez dans un instant.",
    );
  }
  return json.email.trim().toLowerCase();
}

export function perimetresDe(scope: string | undefined): string[] {
  return (scope ?? "").split(/\s+/).filter(Boolean);
}

/** Les périmètres qu'il nous faut et que l'utilisateur n'a pas accordés. */
export function perimetresManquants(accordes: readonly string[]): string[] {
  return PERIMETRES.filter((p) => !accordes.includes(p));
}
