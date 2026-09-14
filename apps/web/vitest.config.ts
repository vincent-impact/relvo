import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tests unitaires de l'application web. Volontairement SANS base de données et
// sans serveur : ce qu'on teste ici est de la logique pure (la décision de
// gating du proxy, les gardes du client d'inférence), et un test qui exigerait
// une infrastructure ne tournerait pas assez souvent pour protéger quoi que ce
// soit.

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      // PITFALLS.md #34 — `server-only` lève à l'import sous vitest.
      "server-only": resolve(
        import.meta.dirname,
        "./test/stubs/server-only.ts",
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
