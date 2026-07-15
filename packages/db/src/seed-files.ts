import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Fixtures de fichiers du compte démo (M4.6).
//
// Les PDF vivent en git (`prisma/fixtures/`) et sont poussés dans R2 à chaque
// reset. Sans ça, le seed poserait des clés pointant vers rien : cliquer un
// document de la démo renverrait « introuvable ».
//
// Les clés sont DÉTERMINISTES (`…/seed/<nom>`) : un PUT écrase en place, donc
// rejouer le reset ne crée aucune copie. Combiné à la purge par préfixe du
// compte, un reset laisse le bucket dans un état identique quoi qu'il arrive.

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "fixtures",
);

/** Contrat minimal attendu du stockage — cf. domain/storage-port.ts. */
type FileWriter = {
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void>;
};

/** Fichiers de démo, par nom. La clé est dérivée du nom (cf. `seedFileKey`). */
export const DEMO_FIXTURES = [
  { filename: "catalogue-avipro-2026.pdf", scope: "knowledge" },
  { filename: "plan-maitrise-sanitaire.pdf", scope: "knowledge" },
  { filename: "media-kit-parisfoodguide.pdf", scope: "knowledge" },
  { filename: "bon-livraison-SB210.pdf", scope: "attachments" },
] as const satisfies ReadonlyArray<{
  filename: string;
  scope: "knowledge" | "attachments";
}>;

/** Clé déterministe d'une fixture — même formule que le seed. */
export function seedFileKey(
  accountId: string,
  scope: "knowledge" | "attachments",
  filename: string,
): string {
  return `accounts/${accountId}/${scope}/seed/${filename}`;
}

/**
 * (Re)pousse les fixtures dans le stockage.
 *
 * Pas de purge : le `deleteMany` sur l'Account déclenche le trigger, qui met
 * TOUTES les clés du compte (fixtures + uploads du béta-testeur) dans l'outbox.
 * Le cron les supprimera. Les fixtures, elles, sont reposées sur les mêmes clés
 * déterministes et seront donc épargnées par le garde-fou `stillReferenced`.
 */
export async function seedDemoFiles(
  storage: FileWriter,
  accountId: string,
): Promise<{ uploaded: number }> {
  for (const fixture of DEMO_FIXTURES) {
    const body = await readFile(join(FIXTURES_DIR, fixture.filename));
    await storage.put({
      key: seedFileKey(accountId, fixture.scope, fixture.filename),
      body: new Uint8Array(body),
      contentType: "application/pdf",
    });
  }

  return { uploaded: DEMO_FIXTURES.length };
}
