// Erreurs métier standardisées (M3.3). Les fonctions de domaine lèvent une
// `DomainError` sur violation de règle ; les couches d'appel (Server Actions,
// Route Handlers) la mappent vers leur format (ActionResult / Response JSON).

export type DomainErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "FORBIDDEN_GENERAL_FOLDER"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_STATE";

const DEFAULT_HTTP_STATUS: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  FORBIDDEN_GENERAL_FOLDER: 422,
  INVALID_STATUS_TRANSITION: 422,
  INVALID_STATE: 422,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  /** Détails optionnels (ex : fieldErrors Zod) à exposer à l'appelant. */
  readonly details?: unknown;

  constructor(
    code: DomainErrorCode,
    message: string,
    options?: { httpStatus?: number; details?: unknown },
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = options?.httpStatus ?? DEFAULT_HTTP_STATUS[code];
    this.details = options?.details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Lève NOT_FOUND si la valeur est nulle, sinon la renvoie (narrow non-null). */
export function assertFound<T>(
  value: T | null | undefined,
  label = "Ressource",
): T {
  if (value === null || value === undefined) {
    throw new DomainError("NOT_FOUND", `${label} introuvable.`);
  }
  return value;
}
