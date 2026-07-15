import "dotenv/config";
import { buildObjectKey, loadStorageConfig, createR2Storage } from "../src";

// Test de fumée du stockage (M4.1) — aller-retour RÉEL contre le bucket.
//
// Vérifie ce que les tests unitaires ne peuvent pas : que les credentials sont
// bons, que l'endpoint de juridiction répond, qu'une URL pré-signée d'upload
// accepte bien un PUT navigateur, et que la lecture pré-signée rend l'octet
// exact. Écrit puis supprime un objet jetable.
//
//   pnpm --filter @relvo/storage smoke
//
// Lit les variables depuis packages/storage/.env, ou celles déjà exportées.

const CONTENT = `relvo smoke test ${new Date().toISOString()}`;

async function main() {
  const config = loadStorageConfig();
  const storage = createR2Storage(config);

  console.log(`Bucket      : ${config.bucket}`);
  console.log(`Endpoint    : ${config.endpoint}`);
  console.log(`Juridiction : ${config.jurisdiction}`);
  if (config.jurisdiction !== "eu") {
    console.warn(
      "⚠️  Juridiction ≠ eu — les données ne sont pas garanties en UE.",
    );
  }
  console.log();

  const key = buildObjectKey({
    accountId: "00000000-0000-0000-0000-000000000000",
    scope: "knowledge",
    filename: "smoke-test.txt",
  });
  const body = Buffer.from(CONTENT, "utf8");

  // 1. Upload via URL pré-signée, exactement comme le fera le navigateur.
  const upload = await storage.presignUpload({
    key,
    contentType: "text/plain",
    contentLength: body.byteLength,
  });

  const put = await fetch(upload.url, {
    method: "PUT",
    headers: upload.requiredHeaders,
    body,
  });
  if (!put.ok) {
    throw new Error(
      `Upload refusé : HTTP ${put.status} ${put.statusText}\n${await put.text()}`,
    );
  }
  console.log(`✓ Upload pré-signé      → ${key}`);

  // 2. L'objet existe, avec la bonne taille.
  const meta = await storage.head(key);
  if (!meta)
    throw new Error("head() ne trouve pas l'objet qui vient d'être écrit.");
  if (meta.size !== body.byteLength) {
    throw new Error(`Taille incohérente : ${meta.size} ≠ ${body.byteLength}`);
  }
  console.log(
    `✓ head()                → ${meta.size} octets, ${meta.contentType}`,
  );

  // 3. Lecture pré-signée : l'octet doit revenir à l'identique.
  const downloadUrl = await storage.presignDownload({ key });
  const get = await fetch(downloadUrl);
  const roundTrip = await get.text();
  if (roundTrip !== CONTENT) {
    throw new Error(
      `Contenu altéré :\n  attendu : ${CONTENT}\n  reçu    : ${roundTrip}`,
    );
  }
  console.log("✓ Download pré-signé    → contenu identique");

  // 4. Sans signature, l'objet ne doit PAS être lisible. Le bucket est privé :
  //    si ce test passe, c'est que le bucket est exposé publiquement.
  const naked = `${config.endpoint}/${config.bucket}/${key}`;
  const unsigned = await fetch(naked);
  if (unsigned.ok) {
    throw new Error(
      `FUITE : l'objet est lisible sans signature (HTTP ${unsigned.status}) → ${naked}`,
    );
  }
  console.log(`✓ Accès non signé refusé → HTTP ${unsigned.status}`);

  // 5. Nettoyage.
  await storage.delete(key);
  if (await storage.head(key))
    throw new Error("delete() n'a pas supprimé l'objet.");
  console.log("✓ delete()              → objet supprimé");

  console.log("\n✅ R2 opérationnel.");
}

main().catch((error) => {
  console.error(
    `\n❌ ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
