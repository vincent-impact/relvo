// Utilitaires partagés des lanceurs du jeu d'évaluation (M7.17) : lecture
// des arguments, parallélisme borné, pourcentages et moyennes. Les lanceurs
// plus anciens portent encore leur copie ; les nouveaux importent d'ici.

export function arg(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? (process.argv[i + 1] ?? defaut) : defaut;
}

export async function enParallele<T, R>(
  items: T[],
  n: number,
  f: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await f(items[k]);
      }
    }),
  );
  return out;
}

export function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)} % (${n}/${d})`;
}

export function moy(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
