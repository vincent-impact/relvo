// Diagnostic Unipile — teste la paire (DSN, clé) contre l'API réelle.
//
// La réception (webhooks entrants) N'utilise PAS notre clé : seul l'envoi /
// la (re)connexion l'utilisent. Ce script appelle GET /api/v1/accounts (endpoint
// au niveau du workspace) avec la clé de l'env, sur PLUSIEURS DSN candidats, et
// affiche pour chacun le statut HTTP + les comptes listés. Le bon DSN = celui qui
// renvoie 200 ET contient tes comptes connectés (Gmail vincent@vccimpact.fr).
//
// Usage :
//   node --env-file=apps/web/.env.local apps/web/scripts/unipile-check.mjs
//   (ou exporte UNIPILE_API_KEY à la main puis lance le script)

const key = process.env.UNIPILE_API_KEY;
if (!key) {
  console.error("❌ UNIPILE_API_KEY absent de l'env.");
  process.exit(1);
}

// DSN candidats : celui de ton .env.local + celui du dashboard de la capture.
// Ajoute-en d'autres au besoin.
const dsns = [
  process.env.UNIPILE_DSN?.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  "api18.unipile.com:14808",
  "api29.unipile.com:15990",
].filter((d, i, a) => d && a.indexOf(d) === i);

console.log(`Clé (masquée) : ${key.slice(0, 4)}…${key.slice(-4)}\n`);

for (const dsn of dsns) {
  const url = `https://${dsn}/api/v1/accounts`;
  try {
    const res = await fetch(url, {
      headers: { "X-API-KEY": key, accept: "application/json" },
    });
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j.items)) {
        detail = `${j.items.length} compte(s) : ${j.items
          .map((i) => `${i.name ?? i.type ?? "?"} [${i.id}]`)
          .join(", ")}`;
      }
    } catch {
      /* réponse non-JSON : on garde le texte brut */
    }
    const flag = res.ok ? "✅" : "❌";
    console.log(`${flag} ${dsn} → HTTP ${res.status}\n   ${detail}\n`);
  } catch (e) {
    console.log(`⚠️  ${dsn} → erreur réseau : ${e.message}\n`);
  }
}
