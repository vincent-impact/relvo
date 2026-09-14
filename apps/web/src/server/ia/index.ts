import "server-only";
// Point d'entrée du module d'inférence (M7). Le pipeline (tranche 4+) et
// l'échange avec Relvo (M10) n'importent que d'ici. La garde `server-only`
// vit ici et pas dans les fichiers : les scripts d'évaluation, hors Next,
// importent les fichiers directement.
export * from "./client";
export * from "./config";
export * from "./tarifs";
export * from "./schemas";
export * from "./contexte";
export * from "./produit";
