import { z } from "zod";
import type { StorageScope } from "./keys";

// Validation des uploads (M4.5). Appliquée AVANT d'émettre une URL pré-signée :
// après, le navigateur pousse directement dans le bucket sans repasser par nous.
//
// Ce qui rend cette allowlist réellement contraignante, c'est que le
// `contentType` validé ici est ensuite SIGNÉ dans l'URL (cf. `signableHeaders`
// dans r2.ts). Sans cette signature, le client pourrait déclarer `application/pdf`
// pour obtenir l'URL puis pousser autre chose — vérifié, R2 acceptait.

/** Types acceptés, par usage. Volontairement restrictif : on élargira au besoin. */
export const ALLOWED_MIME_TYPES: Record<StorageScope, readonly string[]> = {
  // Connaissances (invariant n°18) : PDF et images consultables.
  knowledge: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "text/markdown",
  ],
  // Pièces jointes reçues par email / WhatsApp : plus large, on subit l'entrant.
  attachments: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "text/plain",
    "text/csv",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "video/mp4",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

/**
 * Plafonds de taille, par usage.
 *
 * Bornés bien en dessous des limites de R2 (5 Go en single-part) et d'Anthropic
 * (500 Mo/fichier) : ce qui nous contraint réellement, c'est le free tier de
 * 10 Go et le fait qu'un dirigeant n'uploade pas un film. Un plafond bas est
 * aussi la protection la plus simple contre une facture de dépassement.
 */
export const MAX_FILE_SIZE_BYTES: Record<StorageScope, number> = {
  knowledge: 32 * 1024 * 1024, // 32 Mo — un PDF de contrat scanné passe large
  attachments: 64 * 1024 * 1024, // 64 Mo — vidéo WhatsApp courte
};

/**
 * Le nom de fichier n'est PAS demandé ici : il ne sert pas à construire la clé
 * (un UUID suffit) et il vit en base, où il alimente le `Content-Disposition`.
 * Moins d'entrée client = moins à valider.
 */
export function buildUploadRequestSchema(scope: StorageScope) {
  const allowed = ALLOWED_MIME_TYPES[scope];
  const maxSize = MAX_FILE_SIZE_BYTES[scope];

  return z.object({
    contentType: z
      .string()
      .trim()
      .refine((type) => allowed.includes(type), {
        message: "Ce type de fichier n'est pas accepté.",
      }),
    contentLength: z
      .number()
      .int()
      .positive()
      .max(maxSize, {
        message: `Fichier trop volumineux (max ${Math.round(maxSize / 1024 / 1024)} Mo).`,
      }),
  });
}

export type UploadRequest = z.infer<
  ReturnType<typeof buildUploadRequestSchema>
>;
