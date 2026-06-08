import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// Ré-export de tout le client généré : PrismaClient, types de modèles et enums
// (Actor, SubjectStatus, Priority, TaskKind, TriageHint, …).
export * from "./generated/prisma/client.js";

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
  const adapter = new PrismaPg({ connectionString });
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
} from "./generated/prisma/client.js";

export type {
  SubjectStatus as StatusType,
  TaskKind as KindType,
} from "./generated/prisma/client.js";
