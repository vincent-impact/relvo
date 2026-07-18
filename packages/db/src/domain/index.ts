// Couche domaine partagée web ↔ worker (M3). Fonctions CRUD tenant-aware,
// conventions (erreurs, résultats, pagination, journal) et agrégations. Chaque
// fonction prend un client tenant (`TenantDb`) déjà scellé sur un account_id.

export * from "./errors";
export * from "./storage-port";
export * from "./email-port";
export * from "./whatsapp-port";
export * from "./file-deletions";
export * from "./result";
export * from "./pagination";
export * from "./helpers";
export * from "./events";
export * from "./reference";

export * from "./folders";
export * from "./knowledge";
export * from "./contacts";
export * from "./channels";
export * from "./subjects";
export * from "./messages";
export * from "./tasks";
export * from "./attachments";
export * from "./actions";
export * from "./queries";
