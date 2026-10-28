import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// LA NOTIFICATION EST AUTHENTIFIÉE (M24.3) : Pub/Sub la pousse avec un jeton
// OIDC que Google signe pour le compte de service de l'abonnement — jamais un
// secret dans l'URL. On le vérifie contre les clés publiques de Google, avec
// notre adresse de webhook pour audience, et on exige que ce soit NOTRE compte
// de service, vérifié.

const EMETTEURS = ["https://accounts.google.com", "accounts.google.com"];

/** L'adresse de notre webhook — l'audience du jeton, celle que l'abonnement push déclare. */
export function adresseDuWebhook(): string {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/webhooks/gmail`;
}
let cles: JWTVerifyGetKey | null = null;

function clesDeGoogle(): JWTVerifyGetKey {
  cles ??= createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );
  return cles;
}

export async function verifierJetonPush(
  jeton: string,
  attendu: { audience: string; compteDeService: string },
  obtenirCles: JWTVerifyGetKey = clesDeGoogle(),
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(jeton, obtenirCles, {
      issuer: EMETTEURS,
      audience: attendu.audience,
    });
    return (
      payload.email === attendu.compteDeService &&
      payload.email_verified === true
    );
  } catch (err) {
    console.warn(
      "[gmail] jeton de notification refusé",
      (err as Error).message,
    );
    return false;
  }
}

/** Ce qu'une notification Pub/Sub porte, une fois son `data` décodé — ou `null`. */
export function notificationDepuis(corps: unknown): {
  emailAddress: string;
  historyId: string;
  messageId: string | null;
} | null {
  const data = (
    corps as { message?: { data?: unknown; messageId?: unknown } } | null
  )?.message;
  if (typeof data?.data !== "string") return null;
  try {
    const json = JSON.parse(
      Buffer.from(data.data, "base64").toString("utf8"),
    ) as {
      emailAddress?: unknown;
      historyId?: unknown;
    };
    if (typeof json.emailAddress !== "string" || json.historyId == null)
      return null;
    return {
      emailAddress: json.emailAddress,
      historyId: String(json.historyId),
      messageId: typeof data.messageId === "string" ? data.messageId : null,
    };
  } catch {
    return null;
  }
}
