// Interface du stockage de fichiers (M4.2).
//
// Le fournisseur (R2 aujourd'hui) vit derrière cette interface. La couche
// domaine ne connaît que `file_url`, une chaîne opaque : tant que tout passe
// par ici, changer de fournisseur ne touche aucun call site métier.

export type PresignedUpload = {
  /** URL à laquelle le NAVIGATEUR envoie le fichier en PUT (pas notre code). */
  url: string;
  /** Clé définitive de l'objet, à persister en base (`file_url`). */
  key: string;
  /** En-têtes que le client DOIT rejouer à l'identique, sinon signature invalide. */
  requiredHeaders: Record<string, string>;
  expiresAt: Date;
};

export type ObjectMetadata = {
  key: string;
  size: number;
  contentType: string | null;
};

/** Le résultat d'une lecture bornée — trois issues, aucune ne lève. */
export type ObjectRead =
  | { status: "ok"; body: Uint8Array; size: number; contentType: string | null }
  | { status: "absent" }
  | { status: "trop_lourd"; size: number };

export interface StorageProvider {
  /**
   * Émet une URL d'upload direct navigateur → stockage.
   *
   * Obligatoire, pas un raccourci de perf : une Vercel Function plafonne le
   * body à 4,5 Mo (non configurable) et une Server Action à 1 Mo. Un PDF de
   * Connaissances dépasse couramment. Le fichier ne transite donc jamais par
   * notre code.
   */
  presignUpload(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  }): Promise<PresignedUpload>;

  /**
   * Émet une URL de lecture temporaire.
   *
   * `downloadFilename` force un `Content-Disposition: attachment` avec un nom
   * lisible — le nom d'origine n'est pas dans la clé (elle est aléatoire).
   */
  presignDownload(input: {
    key: string;
    expiresInSeconds?: number;
    downloadFilename?: string;
  }): Promise<string>;

  /**
   * Écrit un objet depuis le serveur.
   *
   * Réservé aux contenus que NOUS produisons (fixtures du seed démo, médias
   * récupérés par le worker). Un fichier venant d'un navigateur passe par
   * `presignUpload` — le body d'une Vercel Function plafonne à 4,5 Mo.
   */
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void>;

  /** Idempotent : supprimer une clé absente ne lève pas. */
  delete(key: string): Promise<void>;

  /**
   * Lit un objet EN MÉMOIRE, depuis le serveur, sous un plafond.
   *
   * Le plafond est obligatoire : celui qui lit dit combien il accepte de
   * charger, et un objet plus lourd n'est jamais téléchargé — sa taille est lue
   * dans l'en-tête, le corps est abandonné. Sert à ce que l'application LIT
   * elle-même : l'aperçu d'un classeur, les octets d'un fichier à partager
   * (recette R18), plus tard la lecture d'une pièce par Relvo (M8). L'affichage
   * d'une image ou d'un PDF, lui, reste une redirection (`presignDownload`).
   */
  read(input: { key: string; maxBytes: number }): Promise<ObjectRead>;

  /** `null` si l'objet n'existe pas. Sert à vérifier qu'un upload a abouti. */
  head(key: string): Promise<ObjectMetadata | null>;
}
