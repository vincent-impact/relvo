import { isDomainError } from "./errors";

// Résultat d'action standardisé (M3.3) pour les opérations impératives (boutons,
// futurs tools du chatbot). Les actions de formulaire conservent `FormState`.

export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
};
export type ActionResult<T> = ActionOk<T> | ActionErr;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function err(
  code: string,
  message: string,
  details?: unknown,
): ActionErr {
  return { ok: false, code, message, details };
}

/**
 * Exécute un appel de domaine et normalise le résultat en `ActionResult`. Les
 * `DomainError` deviennent des erreurs typées ; toute autre exception est
 * re-levée (bug, à remonter à l'observabilité).
 */
export async function tryAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (isDomainError(error)) {
      return err(error.code, error.message, error.details);
    }
    throw error;
  }
}
