import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/index";

// Setup par worker de test : remet la base à zéro avant chaque test. Le
// singleton Prisma est connecté à `relvo_test` via DATABASE_URL (vitest.config).

// Ordre indifférent grâce à CASCADE ; accounts/folders en tête par lisibilité.
const TABLES = [
  "event_logs",
  "actions",
  "tasks",
  "attachments",
  "subject_conversations",
  "messages",
  "conversations",
  "subjects",
  "channel_configs",
  "channels",
  "contacts",
  "knowledge_documents",
  "folders",
  "accounts",
  "verification_tokens",
  // Outbox de suppression de fichiers (M4.6) : sans ça, la file d'un test
  // déborderait sur le suivant.
  // NB : TRUNCATE ne déclenche PAS les triggers ON DELETE (doc PostgreSQL), donc
  // vider les tables ci-dessus n'enfile rien — c'est ce qu'on veut ici.
  "pending_file_deletions",
];

beforeEach(async () => {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
