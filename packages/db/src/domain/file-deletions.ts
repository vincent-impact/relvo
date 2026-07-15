import { prisma } from "../index";
import type { FileDeleter } from "./storage-port";

// Drainage de l'outbox de suppression de fichiers (M4.6).
//
// La file est alimentée par un TRIGGER PostgreSQL, dans la transaction même de
// la suppression (cf. migration `file_deletion_outbox`). Ce module la consomme
// hors transaction et appelle le stockage.
//
// Ce n'est PAS un balayage de réconciliation : on ne calcule aucune différence,
// on ne liste pas le bucket. On ne supprime que des clés qu'une vraie
// suppression a explicitement mises en file. Une requête qui renverrait vide
// ne supprime donc rien, au lieu de tout supprimer.
//
// La file est une table système, hors tenant : quand on arrive ici, la ligne
// d'origine — et donc son `account_id` — n'existe plus.

export type DrainResult = {
  deleted: number;
  /** Clés ignorées car une autre ligne les référence encore (cf. `stillReferenced`). */
  skipped: number;
  failed: number;
};

/**
 * Une autre ligne référence-t-elle encore cette clé ?
 *
 * Garde-fou contre le scénario qui a fait retirer la suppression automatique de
 * Django en 1.3 : « fields on different models referencing the same file » —
 * supprimer l'une détruisait le fichier de l'autre.
 *
 * Cas concret chez nous : le reset démo supprime le compte (le trigger met les
 * clés des fixtures en file), puis re-uploade les fixtures sur les MÊMES clés
 * déterministes. Sans cette vérification, le worker effacerait les fichiers
 * fraîchement reposés.
 */
async function stillReferenced(storageKey: string): Promise<boolean> {
  const [attachment, document] = await Promise.all([
    prisma.attachment.findFirst({
      where: { storageKey },
      select: { id: true },
    }),
    prisma.knowledgeDocument.findFirst({
      where: { storageKey },
      select: { id: true },
    }),
  ]);
  return attachment !== null || document !== null;
}

/**
 * Consomme la file et supprime les objets correspondants.
 *
 * `FOR UPDATE SKIP LOCKED` : deux drainages concurrents (le cron et un appel
 * manuel) ne se marchent pas dessus et ne suppriment pas deux fois.
 */
export async function drainFileDeletions(
  storage: FileDeleter,
  opts: { batchSize?: number } = {},
): Promise<DrainResult> {
  const batchSize = opts.batchSize ?? 100;
  const result: DrainResult = { deleted: 0, skipped: 0, failed: 0 };

  const batch = await prisma.$queryRaw<
    Array<{ id: bigint; storage_key: string }>
  >`
    SELECT id, storage_key
    FROM pending_file_deletions
    ORDER BY enqueued_at
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `;

  for (const row of batch) {
    try {
      if (await stillReferenced(row.storage_key)) {
        // La clé a été réattribuée : on retire l'entrée sans toucher au fichier.
        await prisma.pendingFileDeletion.delete({ where: { id: row.id } });
        result.skipped++;
        continue;
      }

      await storage.delete(row.storage_key);
      await prisma.pendingFileDeletion.delete({ where: { id: row.id } });
      result.deleted++;
    } catch (error) {
      // On garde l'entrée : elle sera retentée au prochain drainage. C'est ce
      // qui rend une fuite VISIBLE (une ligne qui traîne avec `attempts` qui
      // monte) plutôt que silencieuse.
      await prisma.pendingFileDeletion.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      result.failed++;
    }
  }

  return result;
}

/** Nombre d'entrées en attente — sonde de santé (une file qui monte = un souci). */
export function countPendingFileDeletions(): Promise<number> {
  return prisma.pendingFileDeletion.count();
}
