"use client";

import { useSyncExternalStore } from "react";

// Le jour SÉLECTIONNÉ dans le rail de la semaine, partagé avec le « + » du
// ciel : une tâche créée depuis le Calendrier se propose au jour qu'on
// regarde, pas sans date (retour du dirigeant, 2026-10-15). Un petit magasin
// externe plutôt qu'un contexte : le rail et le bouton sont deux îlots client
// sous une page serveur, sans parent commun côté client. `null` hors du rail
// (vue mois, autres lentilles) : la modale repart alors sans date.

let current: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedDay(key: string | null) {
  if (current === key) return;
  current = key;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSelectedDay(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
