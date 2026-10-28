// Les règles de l'abonnement aux changements (M24.3), sans base ni réseau —
// testables seules, importées par le webhook et par le cron.

/** `users.watch` vaut sept jours ; sous deux, on le repose au passage. */
export const RENOUVELER_SOUS_MS = 2 * 24 * 60 * 60 * 1000;

export function doitRenouveler(
  watchExpireA: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!watchExpireA) return true;
  const t = new Date(watchExpireA).getTime();
  return !Number.isFinite(t) || t - now < RENOUVELER_SOUS_MS;
}
