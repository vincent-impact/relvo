import { getCurrentAccountId } from "@/server/auth-context";
import { tenantDb } from "@/lib/tenant-db";
import { getStorage, keyBelongsToAccount } from "@relvo/storage";

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

  // Ceinture et bretelles : `tenantDb` filtre déjà par account_id, mais une clé
  // hors préfixe du compte signalerait une corruption de données. On refuse.
  if (!keyBelongsToAccount(doc.storageKey, accountId)) {
    return { ok: false, error: "not_found" };
  }

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
  if (!keyBelongsToAccount(attachment.storageKey, accountId)) {
    return { ok: false, error: "not_found" };
  }

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
 * URL de lecture temporaire d'un fichier déjà résolu.
 *
 * Courte durée à dessein : l'URL fuite dans l'historique du navigateur et le
 * `Referer`. 5 min suffisent à ouvrir un PDF, pas à le partager.
 */
export async function signDownloadUrl(file: ResolvedFile): Promise<string> {
  return getStorage().presignDownload({
    key: file.key,
    expiresInSeconds: 5 * 60,
    downloadFilename: file.name,
  });
}
