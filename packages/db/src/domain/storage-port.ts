// Port de stockage vu par le domaine (M4.6).
//
// Le domaine ne dépend PAS de `@relvo/storage` : il déclare le contrat minimal
// dont il a besoin, et le typage structurel de TypeScript fait qu'un
// `StorageProvider` le satisfait sans rien déclarer. Deux bénéfices :
//   - les tests tournent sans credentials R2 (un faux suffit) ;
//   - aucun couplage db → storage, donc pas de cycle possible.
//
// ⚠️ Seul le DRAINAGE de l'outbox (`drainFileDeletions`) reçoit ce port. Les
// fonctions de suppression, elles, ne touchent JAMAIS au stockage : c'est un
// trigger PostgreSQL qui met la clé en file, ce qui capte aussi les cascades
// dont Prisma est aveugle. Ne pas réintroduire de `storage` dans un `delete*`.

export type FileDeleter = {
  delete(key: string): Promise<void>;
};
