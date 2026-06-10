import { z } from "zod";

// Pagination par curseur (M3.3). Convention : les listes acceptent
// `{ cursor?, limit? }` et renvoient `{ items, nextCursor }`. Le curseur est
// l'`id` du dernier élément de la page précédente.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationInput = z.input<typeof paginationSchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Construit les options Prisma (`take`/`cursor`/`skip`) pour une page. On
 * demande `limit + 1` éléments pour savoir s'il existe une page suivante.
 */
export function cursorArgs(input?: PaginationInput) {
  const { cursor, limit } = paginationSchema.parse(input ?? {});
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    _limit: limit,
  };
}

/**
 * Découpe le résultat sur-demandé (`limit + 1`) en page + curseur suivant.
 * `rows` doit contenir des objets avec un champ `id`.
 */
export function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): Page<T> {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: items[items.length - 1]!.id };
  }
  return { items: rows, nextCursor: null };
}
