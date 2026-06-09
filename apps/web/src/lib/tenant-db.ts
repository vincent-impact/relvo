import { prisma } from "@/lib/db";

// Client Prisma tenant-aware (M2.8). Le filtre account_id (invariant n°1) est
// injecté automatiquement par une extension `$extends`, pour ne plus dépendre
// de la vigilance de l'appelant sur chaque requête.

// Seules entités sans colonne account_id : la racine tenant et les jetons.
const NON_TENANT_MODELS = new Set(["Account", "VerificationToken"]);

// Opérations dont le `where` accepte un champ non-unique : on y injecte account_id.
const WHERE_INJECT_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// Lectures par clé unique : `where` n'accepte pas account_id, on filtre donc
// le résultat a posteriori (un enregistrement d'un autre tenant devient null).
const UNIQUE_READ_OPS = new Set(["findUnique", "findUniqueOrThrow"]);

/**
 * Retourne un client Prisma scellé sur un `accountId` : toute lecture/écriture
 * est automatiquement filtrée ou estampillée par ce tenant.
 *
 * Couvert automatiquement : findMany, findFirst(OrThrow), findUnique(OrThrow)
 * (filtrage du résultat), count, aggregate, groupBy, updateMany, deleteMany,
 * create, createMany.
 *
 * ⚠️ Non couvert : update / upsert / delete par clé unique — le `where` unique
 * de Prisma n'accepte pas account_id. Pour ces cas, passer par updateMany /
 * deleteMany via ce client (filtrés sur account_id), ou scoper explicitement.
 */
export function tenantDb(accountId: string) {
  return prisma.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (NON_TENANT_MODELS.has(model)) {
            return query(args);
          }

          if (WHERE_INJECT_OPS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...a.where, accountId };
            return query(args);
          }

          if (operation === "create") {
            const a = args as { data?: Record<string, unknown> };
            a.data = { ...a.data, accountId };
            return query(args);
          }

          if (
            operation === "createMany" ||
            operation === "createManyAndReturn"
          ) {
            const a = args as { data?: unknown };
            a.data = Array.isArray(a.data)
              ? a.data.map((d) => ({ ...(d as object), accountId }))
              : { ...(a.data as object), accountId };
            return query(args);
          }

          if (UNIQUE_READ_OPS.has(operation)) {
            const result = (await query(args)) as {
              accountId?: string;
            } | null;
            if (result && result.accountId !== accountId) {
              if (operation === "findUniqueOrThrow") {
                throw new Error("Enregistrement introuvable pour ce compte.");
              }
              return null;
            }
            return result;
          }

          // update / upsert / delete par clé unique : non scopés ici (cf. JSDoc).
          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
