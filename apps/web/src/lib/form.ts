// État partagé des Server Actions de formulaire, consommé côté client via
// React 19 `useActionState`.

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Erreurs Zod par champ (issues de error.flatten().fieldErrors). */
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialFormState: FormState = { status: "idle" };
