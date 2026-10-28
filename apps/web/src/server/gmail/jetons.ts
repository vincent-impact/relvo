import { chiffrer, dechiffrer } from "./chiffrement";
import type { JetonsGoogle } from "./oauth";

// Ce que la configuration d'un canal `gmail` garde dans `connectionData`
// (M24.2) : les jetons CHIFFRÉS, l'échéance du jeton d'accès, les périmètres
// accordés. Les tranches suivantes y ajoutent le dernier numéro d'historique
// et l'échéance de l'abonnement aux changements — toujours à côté, jamais à
// la place.

export type DonneesGmail = {
  jetons: {
    /** Chiffré (`chiffrement.ts`). */
    rafraichissement: string;
    /** Chiffré. */
    acces: string;
    /** ISO : quand le jeton d'accès cesse de valoir. */
    expireA: string;
  };
  perimetres: string[];
  /** Le dernier numéro d'historique relu (tranche 4). */
  historyId?: string;
  /** L'échéance de `users.watch`, ISO (tranche 4). */
  watchExpireA?: string;
};

export function donneesDepuisJetons(
  j: JetonsGoogle,
  existantes?: Record<string, unknown> | null,
): Record<string, unknown> {
  // Une reconnexion garde ce que la boîte savait déjà (historique, abonnement) :
  // seuls les jetons et les périmètres se remplacent.
  const {
    jetons: _j,
    perimetres: _p,
    ...reste
  } = (existantes ?? {}) as Partial<DonneesGmail>;
  void _j;
  void _p;
  return {
    ...reste,
    jetons: {
      rafraichissement: chiffrer(j.rafraichissement),
      acces: chiffrer(j.acces),
      expireA: j.expireA.toISOString(),
    },
    perimetres: j.perimetres,
  };
}

/** Les jetons en clair depuis `connectionData` — `null` si le canal n'en a pas (ou plus). */
export function jetonsDepuisDonnees(
  connectionData: unknown,
): JetonsGoogle | null {
  const d = connectionData as Partial<DonneesGmail> | null | undefined;
  const j = d?.jetons;
  if (!j?.rafraichissement || !j.acces || !j.expireA) return null;
  return {
    rafraichissement: dechiffrer(j.rafraichissement),
    acces: dechiffrer(j.acces),
    expireA: new Date(j.expireA),
    perimetres: d?.perimetres ?? [],
  };
}
