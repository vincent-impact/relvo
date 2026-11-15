"use client";

import { useMemo, useSyncExternalStore } from "react";

// Un ENSEMBLE D'IDENTIFIANTS retenu sur l'appareil (localStorage) — les
// branches repliées de l'arbre des dossiers, les branches dépliées de la page
// Sujets. C'est un confort de lecture, pas une donnée : il appartient à
// l'appareil, jamais au compte.
//
// Le stockage est un magasin EXTERNE, lu par `useSyncExternalStore` : le
// serveur et la première peinture disent « rien de retenu », puis l'appareil
// impose ce qu'il sait, sans écart d'hydratation ni `setState` dans un effet.

const RIEN = "[]";

const ecouteurs = new Set<() => void>();
function abonner(cb: () => void) {
  ecouteurs.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ecouteurs.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function lire(cle: string): string {
  try {
    return window.localStorage.getItem(cle) ?? RIEN;
  } catch {
    return RIEN;
  }
}

function analyser(brut: string): Set<string> {
  try {
    const ids = JSON.parse(brut) as unknown;
    return new Set(
      Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function ecrire(cle: string, ids: Iterable<string>) {
  try {
    window.localStorage.setItem(cle, JSON.stringify([...ids]));
  } catch {
    // Navigation privée, stockage plein : rien n'est retenu, rien de grave.
  }
  ecouteurs.forEach((cb) => cb());
}

export function useIdsRetenus(cle: string) {
  const brut = useSyncExternalStore(
    abonner,
    () => lire(cle),
    () => RIEN,
  );
  const ids = useMemo(() => analyser(brut), [brut]);
  function bascule(id: string) {
    const apres = new Set(ids);
    if (apres.has(id)) apres.delete(id);
    else apres.add(id);
    ecrire(cle, apres);
  }
  function remplace(tous: Iterable<string>) {
    ecrire(cle, tous);
  }
  return { ids, bascule, remplace };
}
