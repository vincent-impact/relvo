// Script d'ops (M5) — enregistre/liste le webhook d'ingestion email Unipile.
//
// Utilise le SDK officiel + tes clés depuis apps/web/.env.local, jamais en dur.
// Lancer depuis apps/web :
//   node --env-file=.env.local scripts/unipile-webhook.mjs list
//   node --env-file=.env.local scripts/unipile-webhook.mjs create https://xxxx.trycloudflare.com
//   node --env-file=.env.local scripts/unipile-webhook.mjs delete <webhook_id>
//
// `create` pose l'event `mail_received` + le header secret `Unipile-Auth` (lu
// depuis UNIPILE_WEBHOOK_SECRET). Rien n'est affiché des secrets.

import { UnipileClient } from "unipile-node-sdk";

const { UNIPILE_DSN, UNIPILE_API_KEY, UNIPILE_WEBHOOK_SECRET } = process.env;
if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error("✗ UNIPILE_DSN / UNIPILE_API_KEY absents de l'environnement.");
  process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
// Le dashboard Unipile donne le DSN sans schéma → on préfixe https:// si absent.
const dsn = /^https?:\/\//i.test(UNIPILE_DSN)
  ? UNIPILE_DSN
  : `https://${UNIPILE_DSN}`;
const client = new UnipileClient(dsn, UNIPILE_API_KEY);

async function main() {
  if (cmd === "list") {
    const res = await client.webhook.getAll();
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "create") {
    if (!arg) {
      console.error(
        "Usage: create <PUBLIC_BASE_URL>  (ex. https://xxx.trycloudflare.com)",
      );
      process.exit(1);
    }
    if (!UNIPILE_WEBHOOK_SECRET) {
      console.error(
        "✗ UNIPILE_WEBHOOK_SECRET absent — impossible d'authentifier le webhook.",
      );
      process.exit(1);
    }
    const requestUrl = `${arg.replace(/\/+$/, "")}/api/webhooks/unipile`;
    const res = await client.webhook.create({
      source: "email",
      request_url: requestUrl,
      format: "json",
      events: ["mail_received"],
      headers: [{ key: "Unipile-Auth", value: UNIPILE_WEBHOOK_SECRET }],
      name: "relvo-inbound-email",
    });
    console.log("✓ Webhook email créé →", requestUrl);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "create-status") {
    if (!arg) {
      console.error("Usage: create-status <PUBLIC_BASE_URL>");
      process.exit(1);
    }
    if (!UNIPILE_WEBHOOK_SECRET) {
      console.error("✗ UNIPILE_WEBHOOK_SECRET absent.");
      process.exit(1);
    }
    const requestUrl = `${arg.replace(/\/+$/, "")}/api/webhooks/unipile`;
    const res = await client.webhook.create({
      source: "account_status",
      request_url: requestUrl,
      format: "json",
      headers: [{ key: "Unipile-Auth", value: UNIPILE_WEBHOOK_SECRET }],
      name: "relvo-account-status",
    });
    console.log("✓ Webhook account_status créé →", requestUrl);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "delete") {
    if (!arg) {
      console.error("Usage: delete <webhook_id>");
      process.exit(1);
    }
    const res = await client.webhook.delete(arg);
    console.log("✓ Webhook supprimé:", JSON.stringify(res, null, 2));
    return;
  }

  console.error(
    "Commandes : list | create <url> | create-status <url> | delete <id>",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("✗ Erreur:", err?.message ?? err);
  process.exit(1);
});
