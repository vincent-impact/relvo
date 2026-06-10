import {
  type ActionResult,
  DomainError,
  type TenantDb,
  tryAction,
} from "@relvo/db";
import { getTenantDb } from "@/server/auth-context";
import type { FormState } from "@/lib/form";

// Pont entre la couche domaine (packages/db) et les Server Actions web (M3.3).
// `domainAction` injecte le client tenant du compte connecté et normalise le
// résultat / les DomainError en `ActionResult`.

export async function domainAction<T>(
  fn: (db: TenantDb) => Promise<T>,
): Promise<ActionResult<T>> {
  const db = await getTenantDb();
  return tryAction(() => fn(db));
}

/** Mappe une DomainError vers un FormState (actions de formulaire). */
export function domainErrorToFormState(error: unknown): FormState {
  if (error instanceof DomainError) {
    return { status: "error", message: error.message };
  }
  throw error;
}

export type { ActionResult };
