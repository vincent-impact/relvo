import { getCurrentAccountId } from "@/server/auth-context";
import { tenantDb } from "@/lib/tenant-db";
import { getStorage } from "@relvo/storage";

// Accès au stockage depuis le web (M4.4).
//
// ⚠️ Règle non négociable : une clé d'objet ne vient JAMAIS d'un input client.
// Le client désigne une RESSOURCE par son id ; la clé est résolue depuis la base
// scopée par tenant. Sans ça, changer un paramètre d'URL suffirait à lire le
// fichier d'un autre compte.
//
// L'auth est vérifiée ici, au ras de l'appel au stockage — pas dans un
// middleware : un middleware mal câblé (ou un matcher trop étroit) exposerait
// silencieusement les fichiers.

export type StorageAccessError = "unauthenticated" | "not_found";

export type ResolvedFile = {
  key: string;
  name: string;
  mimeType: string | null;
};

/**
 * Résout le fichier d'un KnowledgeDocument pour le compte connecté.
 * Renvoie une erreur plutôt que de lever : l'appelant est un Route Handler qui
 * doit répondre un statut, pas rediriger.
 */
export async function resolveKnowledgeFile(
  documentId: string,
): Promise<
  { ok: true; file: ResolvedFile } | { ok: false; error: StorageAccessError }
> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return { ok: false, error: "unauthenticated" };

  const db = tenantDb(accountId);
  const doc = await db.knowledgeDocument.findFirst({
    where: { id: documentId, kind: "file" },
    select: { storageKey: true, name: true, mimeType: true },
  });

  if (!doc?.storageKey) return { ok: false, error: "not_found" };

  return {
    ok: true,
    file: { key: doc.storageKey, name: doc.name, mimeType: doc.mimeType },
  };
}

/** Idem pour une pièce jointe de message. */
export async function resolveAttachmentFile(
  attachmentId: string,
): Promise<
  { ok: true; file: ResolvedFile } | { ok: false; error: StorageAccessError }
> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return { ok: false, error: "unauthenticated" };

  const db = tenantDb(accountId);
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId },
    select: { storageKey: true, name: true, mimeType: true },
  });

  if (!attachment) return { ok: false, error: "not_found" };

  return {
    ok: true,
    file: {
      key: attachment.storageKey,
      name: attachment.name,
      mimeType: attachment.mimeType,
    },
  };
}

/**
 * Durée du cache de la redirection. Plafonnée par la durée de l'URL signée
 * (5 min, cf. `DEFAULT_EXPIRY_SECONDS` dans @relvo/storage) : cacher une
 * redirection plus longtemps que sa cible n'est pas valide — c'est le même
 * raisonnement que le `expires_in ActiveStorage.service_urls_expire_in` du
 * RedirectController de Rails.
 */
const REDIRECT_CACHE_SECONDS = 5 * 60;

/**
 * `inline` — le fichier s'affiche dans la page (`<img src>`, `<iframe>`).
 * `attachment` — le navigateur le télécharge sous son vrai nom (la clé étant
 * aléatoire, sans ça il atterrirait avec un nom d'UUID).
 */
export type Disposition = "inline" | "attachment";

/** URL de lecture temporaire d'un fichier déjà résolu. */
export async function signDownloadUrl(
  file: ResolvedFile,
  disposition: Disposition = "attachment",
): Promise<string> {
  return getStorage().presignDownload({
    key: file.key,
    ...(disposition === "attachment" ? { downloadFilename: file.name } : {}),
  });
}

/**
 * En-têtes d'une réponse de redirection vers une URL signée.
 *
 * `private` + `Vercel-CDN-Cache-Control: no-store` : défense en profondeur. Par
 * défaut, la clé de cache d'un CDN est méthode + URL — aucun header de requête,
 * donc une route authentifiée par cookie a la MÊME clé pour tous les
 * utilisateurs. Vercel ne cache pas les réponses `private`, mais on ne s'en
 * remet pas au défaut plateforme : lors de l'incident Railway du 2026-03-30, un
 * cache activé par accident a servi « requests for one user to a different
 * user » — et seules les apps qui envoyaient `private` explicitement ont été
 * épargnées.
 *
 */
export function signedRedirectHeaders(): Record<string, string> {
  return {
    "Cache-Control": `private, max-age=${REDIRECT_CACHE_SECONDS}`,
    "Vercel-CDN-Cache-Control": "no-store",
  };
}
