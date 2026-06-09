"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { type FormState } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import {
  consumeVerificationToken,
  createVerificationToken,
} from "@/lib/tokens";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations";
import { createAccount } from "@/server/account";
import { VerificationTokenType } from "@relvo/db";

// ── Connexion (Credentials) ──────────────────────────────────────────────────
export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // redirectTo déclenche une redirection (NEXT_REDIRECT) en cas de succès.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", message: "Email ou mot de passe incorrect." };
    }
    throw error; // laisse passer NEXT_REDIRECT et autres
  }

  return { status: "idle" };
}

// ── Connexion Google ─────────────────────────────────────────────────────────
export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/" });
}

// ── Déconnexion ──────────────────────────────────────────────────────────────
export async function logoutAction() {
  await signOut({ redirectTo: "/connexion" });
}

// ── Inscription (signup public ouvert) ───────────────────────────────────────
export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { firstName, lastName, email, password } = parsed.data;

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return {
      status: "error",
      message: "Un compte existe déjà avec cette adresse email.",
    };
  }

  const passwordHash = await hashPassword(password);
  await createAccount({ email, firstName, lastName, passwordHash });

  // Email de vérification (non bloquant pour la connexion en bêta).
  const token = await createVerificationToken(
    email,
    VerificationTokenType.email_verification,
  );
  await sendVerificationEmail(email, token);

  // Connexion immédiate puis redirection vers l'accueil.
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Compte créé mais connexion auto échouée → renvoyer vers /connexion.
      return {
        status: "error",
        message: "Compte créé. Connectez-vous pour continuer.",
      };
    }
    throw error;
  }

  return { status: "idle" };
}

// ── Mot de passe oublié ──────────────────────────────────────────────────────
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email } = parsed.data;
  const account = await prisma.account.findUnique({ where: { email } });

  // On envoie le lien uniquement si un compte avec mot de passe existe, mais la
  // réponse reste identique dans tous les cas (pas de fuite d'existence).
  if (account?.passwordHash) {
    const token = await createVerificationToken(
      email,
      VerificationTokenType.password_reset,
    );
    await sendPasswordResetEmail(email, token);
  }

  return {
    status: "success",
    message:
      "Si un compte est associé à cette adresse, un email de réinitialisation vient d'être envoyé.",
  };
}

// ── Réinitialisation du mot de passe ─────────────────────────────────────────
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const email = await consumeVerificationToken(
    parsed.data.token,
    VerificationTokenType.password_reset,
  );
  if (!email) {
    return {
      status: "error",
      message: "Ce lien est invalide ou a expiré. Refaites une demande.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.account.update({
    where: { email },
    // Accéder au lien prouve la possession de l'email → on le marque vérifié.
    data: { passwordHash, emailVerified: new Date() },
  });

  return {
    status: "success",
    message: "Mot de passe mis à jour. Vous pouvez vous connecter.",
  };
}
