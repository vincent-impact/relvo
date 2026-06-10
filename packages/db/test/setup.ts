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
  "messages",
  "subjects",
  "channel_configs",
  "channels",
  "contacts",
  "knowledge_documents",
  "folders",
  "accounts",
  "verification_tokens",
];

beforeEach(async () => {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
