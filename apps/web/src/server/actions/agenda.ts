"use server";

import { requireAccountId } from "@/server/auth-context";
import { cachedAgendaTasks } from "@/server/cached";
import type { TaskItemData } from "@/lib/task-item-data";

// Lecture d'une semaine ARBITRAIRE de tâches (par jour) — alimente le semainier
// slidable de l'Accueil quand l'utilisateur navigue vers une semaine passée /
// future. Réutilise `cachedAgendaTasks` (Vercel Data Cache, clé = semaine + jour) :
// chaque semaine visitée est mise en cache, donc un re-slide est instantané.
export async function loadAgendaWeekAction(
  weekStartISO: string,
  weekEndISO: string,
  dayISO: string,
): Promise<Record<string, TaskItemData[]>> {
  const accountId = await requireAccountId();
  return cachedAgendaTasks(accountId, weekStartISO, weekEndISO, dayISO);
}
