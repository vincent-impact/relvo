// Stockage de fichiers partagé `apps/web` ⇄ `apps/worker` (M4).
//
// Fournisseur : Cloudflare R2 (décision 2026-07-15, cf. spec/architecture.md §5).
// Tout passe par `StorageProvider` : la couche domaine ne connaît que
// `file_url`, une chaîne opaque, donc changer de fournisseur ne touche aucun
// call site métier.
//
// ⚠️ Rappel d'architecture : R2 est la SOURCE DE VÉRITÉ. La Files API
// d'Anthropic (`anthropic_file_id`) n'est qu'une copie d'inférence en écriture
// seule — un fichier qu'on y uploade porte `downloadable: false` et n'est
// jamais relisible. L'affichage utilisateur passe toujours par ici.

export { loadStorageConfig, type StorageConfig } from "./config";
export { buildObjectKey, type StorageScope } from "./keys";
export type {
  ObjectMetadata,
  PresignedUpload,
  StorageProvider,
} from "./provider";
export { createR2Storage } from "./r2";
export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  buildUploadRequestSchema,
  type UploadRequest,
} from "./validation";

import { createR2Storage } from "./r2";
import type { StorageProvider } from "./provider";

let cached: StorageProvider | undefined;

/**
 * Instance partagée, construite au premier appel.
 *
 * Paresseux à dessein : instancier à l'import ferait échouer `next build`, où
 * les variables d'environnement runtime ne sont pas toutes présentes.
 */
export function getStorage(): StorageProvider {
  cached ??= createR2Storage();
  return cached;
}
