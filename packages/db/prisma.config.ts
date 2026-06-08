import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 : la config CLI (schéma, migrations, URL de connexion) vit ici,
// plus dans le bloc datasource du schéma. Cf. https://pris.ly/prisma-config
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
