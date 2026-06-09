import { createServer } from "node:http";
import "dotenv/config";

// Le worker partage le schéma via @relvo/db (wiring validé dès le squelette).
// Le runtime Baileys + la file BullMQ + le endpoint `send` arrivent en M6/M7.
import type { Actor } from "@relvo/db";

const PORT = Number(process.env.PORT ?? 8081);

const startedAt = new Date().toISOString();

const server = createServer((req, res) => {
  if (
    req.method === "GET" &&
    (req.url === "/health" || req.url === "/healthz")
  ) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "relvo-worker",
        startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ status: "not_found" }));
});

server.listen(PORT, () => {
  // Référence triviale à un type partagé pour prouver le lien @relvo/db.
  const defaultActor: Actor = "system";
  console.info(
    `[worker] relvo-worker démarré sur http://localhost:${PORT} (healthcheck: /health) — actor par défaut: ${defaultActor}`,
  );
});

const shutdown = (signal: string) => {
  console.info(`[worker] signal ${signal} reçu, arrêt en cours…`);
  server.close(() => {
    console.info("[worker] serveur arrêté proprement.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
