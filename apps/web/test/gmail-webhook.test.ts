import { describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { doitRenouveler } from "@/server/gmail/abonnement-regles";
import {
  notificationDepuis,
  verifierJetonPush,
} from "@/server/gmail/verification";

// LE WEBHOOK GMAIL (M24.3), sans Google : le jeton OIDC d'une notification se
// vérifie contre des clés — ici les nôtres —, avec notre adresse pour
// audience et notre compte de service pour auteur ; le corps Pub/Sub se
// décode ; l'abonnement se renouvelle sous deux jours.

const AUDIENCE = "https://app.relvo.net/api/webhooks/gmail";
const COMPTE = "relvo-webhook@relvo-498914.iam.gserviceaccount.com";

async function cles() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  return {
    privateKey,
    jwks: createLocalJWKSet({ keys: [{ ...jwk, kid: "k1", alg: "RS256" }] }),
  };
}

function signer(privateKey: CryptoKey, claims: Record<string, unknown>) {
  return new SignJWT({ email: COMPTE, email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://accounts.google.com")
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("verifierJetonPush", () => {
  it("accepte le jeton de notre compte de service pour notre adresse, et rien d'autre", async () => {
    const { privateKey, jwks } = await cles();
    const attendu = { audience: AUDIENCE, compteDeService: COMPTE };
    expect(
      await verifierJetonPush(await signer(privateKey, {}), attendu, jwks),
    ).toBe(true);
    // Un autre compte de service, même signé par Google.
    expect(
      await verifierJetonPush(
        await signer(privateKey, { email: "autre@x.iam.gserviceaccount.com" }),
        attendu,
        jwks,
      ),
    ).toBe(false);
    // Un compte non vérifié.
    expect(
      await verifierJetonPush(
        await signer(privateKey, { email_verified: false }),
        attendu,
        jwks,
      ),
    ).toBe(false);
    // Une autre audience : le jeton d'un autre webhook.
    expect(
      await verifierJetonPush(
        await signer(privateKey, {}),
        { ...attendu, audience: "https://ailleurs" },
        jwks,
      ),
    ).toBe(false);
    // Une autre clé.
    const autre = await cles();
    expect(
      await verifierJetonPush(
        await signer(autre.privateKey, {}),
        attendu,
        jwks,
      ),
    ).toBe(false);
    expect(await verifierJetonPush("pas.un.jeton", attendu, jwks)).toBe(false);
  });
});

describe("notificationDepuis", () => {
  it("décode l'adresse et le numéro d'historique du corps Pub/Sub", () => {
    const data = Buffer.from(
      JSON.stringify({
        emailAddress: "Moi@Tastycrousty.fr",
        historyId: 1234567,
      }),
    ).toString("base64");
    expect(
      notificationDepuis({
        message: { data, messageId: "m-1" },
        subscription: "s",
      }),
    ).toEqual({
      emailAddress: "Moi@Tastycrousty.fr",
      historyId: "1234567",
      messageId: "m-1",
    });
    expect(
      notificationDepuis({ message: { data: "pas du base64 json" } }),
    ).toBeNull();
    expect(notificationDepuis({})).toBeNull();
    expect(notificationDepuis(null)).toBeNull();
  });
});

describe("doitRenouveler", () => {
  it("sans échéance, ou sous deux jours, oui ; sinon non", () => {
    const now = Date.parse("2026-10-28T10:00:00Z");
    expect(doitRenouveler(undefined, now)).toBe(true);
    expect(doitRenouveler("n'importe quoi", now)).toBe(true);
    expect(doitRenouveler("2026-10-30T09:00:00Z", now)).toBe(true);
    expect(doitRenouveler("2026-11-03T10:00:00Z", now)).toBe(false);
  });
});
