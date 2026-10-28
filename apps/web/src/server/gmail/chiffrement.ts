import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Le CHIFFREMENT des secrets d'une boîte (M24.2) : les jetons OAuth que Google
// nous confie ne sont jamais en clair en base. AES-256-GCM, une clé en
// variable d'environnement (`RELVO_CHIFFREMENT_CLE`, 32 octets en base64), un
// vecteur d'initialisation par secret, l'étiquette d'authentification qui
// refuse toute altération. Le texte chiffré se reconnaît à son préfixe de
// version : une rotation de clé ou d'algorithme saura quoi relire.

const VERSION = "v1";
const IV_OCTETS = 12;

function cle(): Buffer {
  const brute = process.env.RELVO_CHIFFREMENT_CLE;
  if (!brute) {
    throw new Error(
      "RELVO_CHIFFREMENT_CLE manque : les jetons d'une boîte ne peuvent ni se chiffrer ni se relire.",
    );
  }
  const octets = Buffer.from(brute, "base64");
  if (octets.length !== 32) {
    throw new Error(
      "RELVO_CHIFFREMENT_CLE doit faire 32 octets en base64 (openssl rand -base64 32).",
    );
  }
  return octets;
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(IV_OCTETS);
  const cipher = createCipheriv("aes-256-gcm", cle(), iv);
  const texte = Buffer.concat([cipher.update(clair, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    texte.toString("base64url"),
  ].join(".");
}

export function dechiffrer(chiffre: string): string {
  const [version, iv, tag, texte] = chiffre.split(".");
  if (version !== VERSION || !iv || !tag || !texte) {
    throw new Error("Secret illisible : forme inconnue.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    cle(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(texte, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Le chiffrement est possible : la clé est posée et bien formée. */
export function chiffrementConfigure(): boolean {
  try {
    cle();
    return true;
  } catch {
    return false;
  }
}
