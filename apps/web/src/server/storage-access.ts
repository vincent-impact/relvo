import { getCurrentAccountId } from "@/server/auth-context";
import { tenantDb } from "@/lib/tenant-db";
import { getStorage } from "@relvo/storage";
import { completerPiece } from "@/server/medias";

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

export type StorageAccessError =
  | "unauthenticated"
  | "not_found"
  // Une pièce gardée en RÉFÉRENCE (M25.3) qu'on n'a pas pu aller chercher :
  /** le fournisseur du canal ne la sert plus ; */
  | "plus_servie"
  /** elle pèse plus que ce que Relvo stocke ; */
  | "trop_lourde"
  /** le fournisseur ou le stockage n'a pas répondu. */
  | "source_muette";

/** Ce qu'on sait d'une pièce qu'on n'a pas pu ouvrir — pour le dire à l'écran. */
export type PieceRefusee = {
  name: string;
  mimeType: string | null;
  size: number | null;
};

export type Resolution =
  | { ok: true; file: ResolvedFile }
  | { ok: false; error: StorageAccessError; piece?: PieceRefusee };

/** Le statut HTTP d'un refus. */
export function statutDuRefus(error: StorageAccessError): number {
  switch (error) {
    case "unauthenticated":
      return 401;
    case "plus_servie":
      return 410;
    case "trop_lourde":
      return 413;
    case "source_muette":
      return 502;
    default:
      return 404;
  }
}

export type ResolvedFile = {
  key: string;
  name: string;
  mimeType: string | null;
  /** Le poids connu de la base, en octets ; `null` s'il n'a pas été noté. */
  size: number | null;
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
    select: { storageKey: true, name: true, mimeType: true, fileSize: true },
  });

  if (!doc?.storageKey) return { ok: false, error: "not_found" };

  return {
    ok: true,
    file: {
      key: doc.storageKey,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.fileSize,
    },
  };
}

/**
 * Idem pour une pièce jointe de message.
 *
 * Une pièce gardée en RÉFÉRENCE (M25.3) se complète ICI : l'ouvrir, c'est
 * aller la chercher chez le fournisseur de son canal, la stocker, puis la
 * servir comme une autre. Toute lecture d'une pièce passe par cette fonction
 * — c'est ce qui garantit qu'aucune route ne signe une clé qui n'existe pas.
 * ⚠️ En conséquence, rien ne doit appeler une route de pièce pour une
 * référence sans que le dirigeant l'ait touchée : le fil montre sa vignette,
 * jamais `/download` (`AttachmentPreview`).
 */
export async function resolveAttachmentFile(
  attachmentId: string,
): Promise<Resolution> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return { ok: false, error: "unauthenticated" };

  const db = tenantDb(accountId);
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId },
    select: { storageKey: true, name: true, mimeType: true, fileSize: true },
  });

  if (!attachment) return { ok: false, error: "not_found" };
  const piece: PieceRefusee = {
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.fileSize,
  };

  if (attachment.storageKey) {
    return { ok: true, file: { key: attachment.storageKey, ...piece } };
  }

  const completion = await completerPiece(accountId, attachmentId, {
    insister: true,
  });
  if (!completion.ok) {
    const error: StorageAccessError =
      completion.raison === "indisponible"
        ? "plus_servie"
        : completion.raison === "trop_lourde"
          ? "trop_lourde"
          : completion.raison === "sans_source"
            ? "not_found"
            : "source_muette";
    return { ok: false, error, piece };
  }
  // Le poids et le type réels sont ceux du fichier qu'on vient de stocker.
  const stockee = await db.attachment.findFirst({
    where: { id: attachmentId },
    select: { mimeType: true, fileSize: true },
  });
  return {
    ok: true,
    file: {
      key: completion.storageKey,
      name: attachment.name,
      mimeType: stockee?.mimeType ?? attachment.mimeType,
      size: stockee?.fileSize ?? attachment.fileSize,
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
 * Lit un fichier déjà résolu, en mémoire, sous le plafond donné — pour ce que
 * l'application lit elle-même (aperçu, partage : `server/pieces.ts`).
 */
export async function readFile(file: ResolvedFile, maxBytes: number) {
  return getStorage().read({ key: file.key, maxBytes });
}

/** Le poids réel d'un fichier résolu, demandé au stockage ; `null` s'il n'y est plus. */
export async function fileSizeInStorage(
  file: ResolvedFile,
): Promise<number | null> {
  return (await getStorage().head(file.key))?.size ?? null;
}

/**
 * En-têtes d'une réponse de redirection vers une URL signée — et de toute
 * réponse qui porte la donnée d'un compte (aperçu, contenu d'une pièce).
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
