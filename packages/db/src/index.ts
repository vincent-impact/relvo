import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// Ré-export de tout le client généré : PrismaClient, types de modèles et enums
// (Actor, SubjectStatus, Priority, TaskKind, TriageHint, …).
// NB : imports SANS extension — le générateur prisma-client émet des specifiers
// extensionless ; ajouter `.js` casse la résolution de Turbopack au build
// (next build), qui ne mappe pas `.js` → `.ts` comme le fait tsc.
export * from "./generated/prisma/client";

// Ré-export explicite des enums comme **valeurs** runtime (défensif : garantit
// `VerificationTokenType.x`, `AccountRole.ceo`, etc. côté apps/web même si la
// propagation des valeurs via `export *` chaîné variait selon le bundler).
export {
  Actor,
  AccountRole,
  ContactStatus,
  ChannelType,
  ChannelConfigStatus,
  SubjectStatus,
  Priority,
  AbsorptionStatus,
  MessageDirection,
  MessageStatus,
  TriageHint,
  TaskKind,
  TaskStatus,
  CompletionMode,
  ActionType,
  ActionStatus,
  EventEntityType,
  KnowledgeKind,
  VerificationTokenType,
} from "./generated/prisma/enums";

/**
 * Singleton du client Prisma.
 *
 * Prisma 7 exige un driver adapter (ici `@prisma/adapter-pg`) ; l'URL de
 * connexion vient de DATABASE_URL. On met en cache l'instance sur `globalThis`
 * pour éviter d'épuiser le pool lors du hot-reload Next.js en dev.
 */
const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est absente : impossible d'initialiser le client Prisma.",
    );
  }
  // Pool tuné pour le serverless (Vercel ↔ Neon). En prod, DATABASE_URL doit
  // pointer sur l'endpoint **poolé** de Neon (`-pooler` dans l'hôte) : PgBouncer
  // côté Neon mutualise les connexions sur les nombreuses instances de fonction.
  //   - max bas : chaque instance n'ouvre que quelques connexions (Neon plafonne).
  //   - idleTimeout : referme vite les connexions oisives (cold start fréquent).
  //   - connectionTimeout : échoue rapidement si Neon met à se réveiller.
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ─────────────────────────────────────────────────────────────
// Alias canoniques (cf. CLAUDE.md : enums partagés Actor, Status,
// Priority, Kind, TriageHint). Les noms Prisma sont plus explicites
// (SubjectStatus, TaskKind) ; on expose aussi les libellés canoniques.
// ─────────────────────────────────────────────────────────────
export {
  SubjectStatus as Status,
  TaskKind as Kind,
} from "./generated/prisma/client";

export type {
  SubjectStatus as StatusType,
  TaskKind as KindType,
} from "./generated/prisma/client";

// ─────────────────────────────────────────────────────────────
// Client tenant-aware + couche domaine (M3) — partagés web ↔ worker.
// ─────────────────────────────────────────────────────────────
export { tenantDb, type TenantDb, type Tx } from "./tenant";
export * from "./domain";

// ─────────────────────────────────────────────────────────────
// Seed du compte démo (source unique) — CLI `pnpm db:seed` + Server Action de
// reset. Placé en dernier : prisma/tenant/domain sont déjà définis ci-dessus.
// ─────────────────────────────────────────────────────────────
export {
  seedDemoAccount,
  seedDemoIfMissing,
  DEMO_EMAIL,
  DEMO_ACCOUNT_ID,
} from "./seed-demo";
