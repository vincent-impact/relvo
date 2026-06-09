// Point d'accès au client Prisma depuis `apps/web`.
//
// Le singleton vit dans `@relvo/db` (partagé web ↔ worker, adapter PG, cache
// hot-reload). On le ré-expose ici pour que le code applicatif importe toujours
// `@/lib/db` — un seul point d'entrée, facile à remplacer par le client
// tenant-aware (cf. lib/tenant-db.ts) quand le filtrage account_id est requis.
export { prisma } from "@relvo/db";
