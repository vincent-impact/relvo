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
  /** Clés ignorées car une autre ligne les référence encore (cf. `encoreReferencees`). */
  skipped: number;
  failed: number;
};

/**
 * Parmi ces clés, lesquelles une autre ligne référence-t-elle encore ?
 *
 * Garde-fou contre le scénario qui a fait retirer la suppression automatique de
 * Django en 1.3 : « fields on different models referencing the same file » —
 * supprimer l'une détruisait le fichier de l'autre.
 *
 * Cas concret chez nous : le reset démo supprime le compte (le trigger met les
 * clés des fixtures en file), puis re-uploade les fixtures sur les MÊMES clés
 * déterministes. Sans cette vérification, le worker effacerait les fichiers
 * fraîchement reposés. Une requête par table pour tout le lot, pas par clé.
 */
async function encoreReferencees(storageKeys: string[]): Promise<Set<string>> {
  const [attachments, documents] = await Promise.all([
    prisma.attachment.findMany({
      where: { storageKey: { in: storageKeys } },
      select: { storageKey: true },
    }),
    prisma.knowledgeDocument.findMany({
      where: { storageKey: { in: storageKeys } },
      select: { storageKey: true },
    }),
  ]);
  const prises = new Set<string>();
  for (const a of attachments) prises.add(a.storageKey);
  for (const d of documents) if (d.storageKey) prises.add(d.storageKey);
  return prises;
}

/**
 * Consomme la file et supprime les objets correspondants.
 *
 * Sans `budgetMs`, UN lot. Avec, des lots tant qu'il reste du temps et des
 * entrées : une purge met des milliers de clés en file d'un coup, et un lot de
 * cent par jour les laisserait des semaines dans le stockage (PITFALLS #80).
 *
 * Les entrées qui ont déjà échoué passent APRÈS les autres (`ORDER BY
 * attempts`) : cent clés que le stockage refuse ne bloquent plus la tête de la
 * file. Une entrée qui échoue n'est pas reprise dans le même drainage.
 *
 * `FOR UPDATE SKIP LOCKED` : deux drainages concurrents (le cron et un appel
 * manuel) ne se marchent pas dessus ; et une suppression au stockage est
 * idempotente — la rejouer ne casse rien.
 */
export async function drainFileDeletions(
  storage: FileDeleter,
  opts: { batchSize?: number; budgetMs?: number; concurrency?: number } = {},
): Promise<DrainResult> {
  const batchSize = opts.batchSize ?? 100;
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const debut = Date.now();
  const result: DrainResult = { deleted: 0, skipped: 0, failed: 0 };
  /** Les entrées qui ont échoué pendant CE drainage : on ne les retente pas. */
  const echouees = new Set<bigint>();

  for (;;) {
    const lot = (
      await prisma.$queryRaw<Array<{ id: bigint; storage_key: string }>>`
        SELECT id, storage_key
        FROM pending_file_deletions
        ORDER BY attempts, enqueued_at, id
        LIMIT ${batchSize + echouees.size}
        FOR UPDATE SKIP LOCKED
      `
    )
      .filter((row) => !echouees.has(row.id))
      .slice(0, batchSize);
    if (lot.length === 0) break;

    const prises = await encoreReferencees(lot.map((r) => r.storage_key));
    /** Entrées à retirer de la file : fichier supprimé, ou clé réattribuée. */
    const soldees: bigint[] = [];

    for (let i = 0; i < lot.length; i += concurrency) {
      await Promise.all(
        lot.slice(i, i + concurrency).map(async (row) => {
          if (prises.has(row.storage_key)) {
            // La clé a été réattribuée : on retire l'entrée sans toucher au fichier.
            soldees.push(row.id);
            result.skipped++;
            return;
          }
          try {
            await storage.delete(row.storage_key);
            soldees.push(row.id);
            result.deleted++;
          } catch (error) {
            // On garde l'entrée : elle sera retentée au prochain drainage. C'est
            // ce qui rend une fuite VISIBLE (une ligne qui traîne avec
            // `attempts` qui monte) plutôt que silencieuse.
            echouees.add(row.id);
            result.failed++;
            await prisma.pendingFileDeletion.update({
              where: { id: row.id },
              data: {
                attempts: { increment: 1 },
                lastError:
                  error instanceof Error ? error.message : String(error),
              },
            });
          }
        }),
      );
    }
    if (soldees.length > 0) {
      await prisma.pendingFileDeletion.deleteMany({
        where: { id: { in: soldees } },
      });
    }

    const resteDuTemps =
      opts.budgetMs !== undefined && Date.now() - debut < opts.budgetMs;
    if (!resteDuTemps || lot.length < batchSize) break;
  }

  return result;
}

/** Nombre d'entrées en attente — sonde de santé (une file qui monte = un souci). */
export function countPendingFileDeletions(): Promise<number> {
  return prisma.pendingFileDeletion.count();
}
