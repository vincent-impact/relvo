// Ce qu'on sait d'un fichier à son nom et à son type, sans l'ouvrir.
//
// Module SANS dépendance, à dessein : le navigateur s'en sert pour décider du
// geste (aperçu d'un classeur, ou écran du fichier) et le serveur pour décider
// de lire. Une seule règle pour les deux — sinon l'écran attend un aperçu que
// le serveur ne calcule pas.

const TYPES_CLASSEUR = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "text/csv",
  "application/csv",
]);

/** L'extension d'un nom de fichier, en minuscules, sans le point ; vide s'il n'en a pas. */
export function extensionDe(nom: string): string {
  const point = nom.lastIndexOf(".");
  return point < 0 ? "" : nom.slice(point + 1).toLowerCase();
}

/**
 * Un classeur se reconnaît à son NOM d'abord : une pièce jointe d'e-mail
 * arrive souvent typée « application/octet-stream ».
 */
export function estUnClasseur(nom: string, mimeType?: string | null): boolean {
  const ext = extensionDe(nom);
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "csv") {
    return true;
  }
  // Un nom qui porte une autre extension l'emporte sur un type trop large.
  if (ext) return false;
  const type = (mimeType ?? "").split(";", 1).join("").trim().toLowerCase();
  return TYPES_CLASSEUR.has(type);
}
