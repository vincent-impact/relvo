import "server-only";
import { expireTenantData } from "@/server/cached";
import { jugerLeGroupe } from "./groupe-jugement";

export type { JugementGroupe } from "./groupe-jugement";

/**
 * Juge un groupe, une fois (M29.3) — depuis l'application : le jugement lui-même
 * est dans `./groupe-jugement`, et ce qu'il change se voit aussitôt à l'écran.
 */
export async function jugerGroupe(
  args: Parameters<typeof jugerLeGroupe>[0],
): ReturnType<typeof jugerLeGroupe> {
  const resultat = await jugerLeGroupe(args);
  if (resultat.issue === "ignore" || resultat.issue === "avis-seul") {
    expireTenantData();
  }
  return resultat;
}
