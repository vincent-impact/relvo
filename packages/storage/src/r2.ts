import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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

/** Plafond dur de R2 sur une URL pré-signée. */
const MAX_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

const DEFAULT_UPLOAD_EXPIRY = 5 * 60;
const DEFAULT_DOWNLOAD_EXPIRY = 5 * 60;

function clampExpiry(seconds: number): number {
  return Math.min(Math.max(Math.floor(seconds), 1), MAX_EXPIRES_IN_SECONDS);
}

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
  });

  // Fonction locale plutôt que méthode : `deleteByPrefix` l'appelle, et passer
  // par `this` casserait dès qu'on déstructure le provider.
  async function listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;

    // `list` plafonne à 1000 clés par appel : sans la boucle de pagination, on
    // ne verrait qu'une partie du préfixe — et un purge partiel est pire qu'un
    // purge absent (il donne l'illusion d'avoir nettoyé).
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return keys;
  }

  return {
    async presignUpload({
      key,
      contentType,
      contentLength,
      expiresInSeconds = DEFAULT_UPLOAD_EXPIRY,
    }): Promise<PresignedUpload> {
      const expiresIn = clampExpiry(expiresInSeconds);

      // `ContentType` et `ContentLength` sont signés : le navigateur ne peut
      // donc pas uploader un type ou un poids autres que ceux validés côté
      // serveur. C'est ce qui empêche une URL obtenue pour un PDF de 1 Mo de
      // servir à pousser un exécutable de 2 Go.
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
        { expiresIn },
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
      expiresInSeconds = DEFAULT_DOWNLOAD_EXPIRY,
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
        { expiresIn: clampExpiry(expiresInSeconds) },
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

    list: listKeys,

    async deleteByPrefix(prefix: string): Promise<number> {
      // Garde-fou : un préfixe vide effacerait le bucket entier. Ça ne devrait
      // jamais arriver, mais le coût d'un `if` est nul face à celui de l'erreur.
      if (prefix.trim().length === 0) {
        throw new Error("deleteByPrefix : préfixe vide refusé.");
      }

      const keys = await listKeys(prefix);
      if (keys.length === 0) return 0;

      // DeleteObjects prend 1000 clés par appel.
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: config.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          }),
        );
      }

      return keys.length;
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
