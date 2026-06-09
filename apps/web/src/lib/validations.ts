import { z } from "zod";

// Email normalisé (trim + lowercase) puis validé. L'unicité d'Account.email
// repose sur cette normalisation systématique.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Adresse email invalide"));

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères")
  .max(72, "Le mot de passe ne peut pas dépasser 72 caractères"); // limite bcrypt

const nameSchema = (label: string) =>
  z.string().trim().min(1, `${label} requis`).max(80);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

export const signupSchema = z.object({
  firstName: nameSchema("Prénom"),
  lastName: nameSchema("Nom"),
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Jeton manquant"),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: nameSchema("Prénom"),
  lastName: nameSchema("Nom"),
  email: emailSchema,
});

export const changePasswordSchema = z.object({
  // Optionnel : un compte Google-only n'a pas de mot de passe actuel. La
  // présence est exigée côté action uniquement si le compte en possède un.
  currentPassword: z.string().optional().default(""),
  newPassword: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
