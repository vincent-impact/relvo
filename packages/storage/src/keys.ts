// Convention de nommage des objets stockés (M4).
//
// Tout objet vit sous `accounts/<accountId>/…`. Le préfixe ne SÉCURISE rien —
// c'est `tenantDb` qui autorise, et la clé est toujours résolue depuis la base,
// jamais reconstruite depuis un input utilisateur. Il sert à auditer (lire un
// listing R2 et voir à qui appartient quoi) et à purger un compte.
//
// Le nom de fichier n'est PAS dans la clé : le vrai nom vit en base et alimente
// le `Content-Disposition` au téléchargement. L'UUID suffit à l'unicité — R2 ne
// versionne pas, un PUT sur une clé existante écrase en silence.

export type StorageScope = "knowledge" | "attachments";

export function buildObjectKey(input: {
  accountId: string;
  scope: StorageScope;
  random?: string;
}): string {
  return `accounts/${input.accountId}/${input.scope}/${input.random ?? crypto.randomUUID()}`;
}
