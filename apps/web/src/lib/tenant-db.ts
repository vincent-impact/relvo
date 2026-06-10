// Le client Prisma tenant-aware vit désormais dans `@relvo/db` (partagé web ↔
// worker depuis M3). Ré-exporté ici pour conserver le point d'entrée historique
// `@/lib/tenant-db` (importé par auth-context).
export { tenantDb, type TenantDb, type Tx } from "@relvo/db";
