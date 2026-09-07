import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tests unitaires de l'application web. Volontairement SANS base de données et
// sans serveur : ce qu'on teste ici est de la logique pure (la décision de
// gating du proxy), et un test qui exigerait une infrastructure ne tournerait
// pas assez souvent pour protéger quoi que ce soit.

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
