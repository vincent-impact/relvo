import { z } from "zod";
import type { StorageScope } from "./keys";

// Validation des uploads (M4.5). Appliquée AVANT d'émettre une URL pré-signée :
// une fois l'URL émise, le navigateur pousse directement dans le bucket sans
// repasser par nous. C'est donc le seul point de contrôle.

/** Types acceptés, par usage. Volontairement restrictif : on élargira au besoin. */
export const ALLOWED_MIME_TYPES: Record<StorageScope, readonly string[]> = {
  // Connaissances (invariant n°18) : PDF et images consultables, notes = pas de fichier.
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
} as const;

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
 * Extensions dont le MIME annoncé par le client ne doit jamais faire foi.
 * On ne se fie pas au `Content-Type` du navigateur — il est déclaratif — donc
 * on croise avec l'extension du nom de fichier.
 */
const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sh",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".msi",
  ".app",
  ".jar",
  ".js",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".html",
  ".htm",
  ".svg", // SVG = vecteur XSS s'il est servi inline
];

export function buildUploadRequestSchema(scope: StorageScope) {
  const allowed = ALLOWED_MIME_TYPES[scope];
  const maxSize = MAX_FILE_SIZE_BYTES[scope];

  return z.object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      // Un nom de fichier ne doit jamais pouvoir remonter l'arborescence.
      .refine((name) => !name.includes("/") && !name.includes("\\"), {
        message: "Nom de fichier invalide.",
      })
      .refine((name) => !name.includes(".."), {
        message: "Nom de fichier invalide.",
      })
      .refine(
        (name) => {
          const lower = name.toLowerCase();
          return !DANGEROUS_EXTENSIONS.some((ext) => lower.endsWith(ext));
        },
        { message: "Ce type de fichier n'est pas accepté." },
      ),
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
