import {
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadStorageConfig, type StorageConfig } from "./config";
import type {
  ObjectMetadata,
  PresignedUpload,
  StorageProvider,
} from "./provider";

// Implémentation Cloudflare R2 (M4.1, décision 2026-07-15).
//
// R2 expose une API S3-compatible : on utilise le SDK AWS tel quel, ce qui
// garde `apps/worker` (Railway) sur un client générique et laisse la porte
// ouverte vers S3. Deux écarts par rapport à S3 à connaître :
//   - `POST` (upload multipart form) N'EST PAS supporté → uploads en `PUT`.
//   - les URLs pré-signées ne fonctionnent QUE sur le domaine S3 API, jamais
//     sur un domaine custom. C'est pour ça qu'il n'y a pas de CDN devant : le
//     cache edge et la pré-signature sont mutuellement exclusifs chez R2.

/**
 * Durée de vie d'une URL signée. 5 min, comme le défaut d'ActiveStorage
 * (`service_urls_expire_in`) : assez pour ouvrir un fichier, trop court pour
 * partager. R2 plafonne à 7 jours, on n'en approche pas.
 */
const DEFAULT_EXPIRY_SECONDS = 5 * 60;

/** Un nom de fichier ne doit pas pouvoir injecter d'en-tête HTTP. */
function encodeDownloadFilename(filename: string): string {
  const ascii = filename.replace(/["\\\r\n]/g, "").slice(0, 200);
  return `attachment; filename*=UTF-8''${encodeURIComponent(ascii)}`;
}

export function createR2Storage(
  config: StorageConfig = loadStorageConfig(),
): StorageProvider {
  const client = new S3Client({
    // R2 n'a pas de régions au sens AWS : la localisation est portée par la
    // juridiction du bucket (voir config.ts). SigV4 exige quand même une
    // valeur — "auto" est celle que Cloudflare documente.
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },

    // ⚠️ OBLIGATOIRE avec R2. Depuis la v3.729, le SDK calcule un checksum par
    // défaut (`WHEN_SUPPORTED`) et injecte `x-amz-checksum-crc32` dans l'URL
    // pré-signée. Deux problèmes :
    //   1. R2 liste `x-amz-checksum-algorithm` comme NON IMPLÉMENTÉ (doc S3 API
    //      compatibility) ;
    //   2. à la présignature il n'y a pas encore de corps, donc le SDK signe le
    //      CRC32 du VIDE (`AAAAAA==`). Si R2 le validait un jour contre le
    //      fichier réellement envoyé, TOUS les uploads non vides échoueraient.
    // Vérifié le 2026-07-15 : R2 l'ignore, nos uploads passaient par chance.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async presignUpload({
      key,
      contentType,
      contentLength,
      expiresInSeconds = DEFAULT_EXPIRY_SECONDS,
    }): Promise<PresignedUpload> {
      const expiresIn = expiresInSeconds;

      // `signableHeaders` est INDISPENSABLE : le presigner AWS met `content-type`
      // dans ses `unsignableHeaders` par défaut (cf. @aws-sdk/s3-request-presigner,
      // `unsignableHeaders.add("content-type")`). Sans cette ligne, `ContentType`
      // n'est PAS signé et le client peut pousser n'importe quel type sur l'URL.
      //
      // Vérifié le 2026-07-15 contre le vrai bucket : sans elle, un PUT en
      // `text/html` sur une URL signée pour `application/pdf` renvoyait 200 et
      // R2 stockait `text/html`. L'allowlist MIME du Route Handler ne servait
      // donc à rien — c'est ici qu'elle devient réellement contraignante.
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
        { expiresIn, signableHeaders: new Set(["content-type"]) },
      );

      return {
        url,
        key,
        requiredHeaders: {
          "Content-Type": contentType,
          "Content-Length": String(contentLength),
        },
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    },

    async presignDownload({
      key,
      expiresInSeconds = DEFAULT_EXPIRY_SECONDS,
      downloadFilename,
    }): Promise<string> {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ...(downloadFilename
            ? {
                ResponseContentDisposition:
                  encodeDownloadFilename(downloadFilename),
              }
            : {}),
        }),
        { expiresIn: expiresInSeconds },
      );
    },

    async put({ key, body, contentType }): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      );
    },

    async delete(key: string): Promise<void> {
      // S3 comme R2 renvoient 204 sur une clé absente : rien à rattraper.
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },

    async head(key: string): Promise<ObjectMetadata | null> {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );

        return {
          key,
          size: result.ContentLength ?? 0,
          contentType: result.ContentType ?? null,
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name } = error as { name?: string };
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}
