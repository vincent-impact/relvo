// Convention de nommage des objets stockés (M4.4).
//
// Tout objet vit sous `accounts/<accountId>/…` : le tenant est porté par la clé
// elle-même, ce qui rend une fuite inter-tenant visible à la lecture du chemin.
//
// ⚠️ Cette convention ne SÉCURISE rien à elle seule. Un préfixe n'est pas un
// contrôle d'accès : la clé doit toujours être résolue depuis la base scopée
// par `getTenantDb()`, jamais reconstruite depuis un input utilisateur. Le
// préfixe sert à auditer et à purger, pas à autoriser.

export type StorageScope = "knowledge" | "attachments";

/** Caractères sûrs pour une clé S3, avec un fallback lisible. */
function slugifySegment(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques décomposés par NFD
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    // Rogne points et tirets aux extrémités : évite les fichiers cachés
    // (`.env`) et les résidus de `../` une fois les `/` neutralisés.
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);

  return slug.length > 0 ? slug : "fichier";
}

/**
 * Construit la clé d'un nouvel objet.
 *
 * Le `random` rend la clé non devinable et évite toute collision entre deux
 * fichiers de même nom : R2 ne versionne pas, un PUT sur une clé existante
 * écrase silencieusement.
 */
export function buildObjectKey(input: {
  accountId: string;
  scope: StorageScope;
  filename: string;
  random?: string;
}): string {
  const random = input.random ?? crypto.randomUUID();
  return `accounts/${input.accountId}/${input.scope}/${random}/${slugifySegment(input.filename)}`;
}

/** Vrai si la clé appartient bien au tenant — garde-fou de dernier recours. */
export function keyBelongsToAccount(key: string, accountId: string): boolean {
  return key.startsWith(`accounts/${accountId}/`);
}

/**
 * Préfixe couvrant tous les fichiers d'un compte.
 *
 * Sert à purger un compte d'un seul geste : la cascade `ON DELETE CASCADE`
 * s'exécute dans PostgreSQL, le code ne voit jamais passer les clés des lignes
 * effacées. Le préfixe est la seule prise qu'on ait sur elles.
 */
export function accountPrefix(accountId: string): string {
  if (accountId.trim().length === 0) {
    throw new Error("accountPrefix : accountId vide refusé.");
  }
  return `accounts/${accountId}/`;
}
