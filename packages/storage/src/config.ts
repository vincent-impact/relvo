import { z } from "zod";

// Configuration du stockage (M4.1). Lue depuis l'environnement, partagée
// `apps/web` (Vercel) et `apps/worker` (Railway) — d'où un package à part
// plutôt qu'un helper dans l'un des deux.

const envSchema = z.object({
  R2_ACCOUNT_ID: z.string().trim().min(1),
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
  R2_BUCKET: z.string().trim().min(1),
  // Juridiction du bucket. `eu` = résidence des données garantie en Union
  // européenne (exigence RGPD, cf. spec/architecture.md §5) — et elle est
  // FIGÉE à la création du bucket. Elle change l'endpoint S3 :
  //   sans juridiction : <account>.r2.cloudflarestorage.com
  //   avec `eu`        : <account>.eu.r2.cloudflarestorage.com
  // Se tromper ici donne des 404/403 opaques, pas une erreur explicite.
  R2_JURISDICTION: z.enum(["eu", "none"]).default("eu"),
});

export type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  jurisdiction: "eu" | "none";
  endpoint: string;
};

/**
 * Construit la config depuis `process.env` (ou un objet fourni, pour les tests).
 * Lève à l'appel — donc au premier usage réel du stockage, jamais à l'import :
 * un module qui jette au chargement casserait le build Next, où les variables
 * d'environnement runtime ne sont pas toutes présentes.
 */
export function loadStorageConfig(
  env: Record<string, string | undefined> = process.env,
): StorageConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const missing = Object.keys(z.flattenError(parsed.error).fieldErrors);
    throw new Error(
      `Configuration R2 incomplète : ${missing.join(", ")}. ` +
        `Renseignez ces variables d'environnement (cf. README).`,
    );
  }

  const { R2_ACCOUNT_ID, R2_JURISDICTION } = parsed.data;
  const host =
    R2_JURISDICTION === "none"
      ? `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : `${R2_ACCOUNT_ID}.${R2_JURISDICTION}.r2.cloudflarestorage.com`;

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: parsed.data.R2_ACCESS_KEY_ID,
    secretAccessKey: parsed.data.R2_SECRET_ACCESS_KEY,
    bucket: parsed.data.R2_BUCKET,
    jurisdiction: R2_JURISDICTION,
    endpoint: `https://${host}`,
  };
}
