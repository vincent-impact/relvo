"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { type FormState } from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createVerificationToken } from "@/lib/tokens";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validations";
import { requireAccount } from "@/server/auth-context";
import { VerificationTokenType } from "@relvo/db";

// ── Mise à jour du profil (nom, email) ───────────────────────────────────────
export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const account = await requireAccount();

  const parsed = updateProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { firstName, lastName, email } = parsed.data;
  const emailChanged = email !== account.email;

  if (emailChanged) {
    const taken = await prisma.account.findUnique({ where: { email } });
    if (taken) {
      return {
        status: "error",
        message: "Cette adresse email est déjà utilisée.",
      };
    }
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      firstName,
      lastName,
      email,
      // Changer d'email réinitialise la vérification.
      ...(emailChanged ? { emailVerified: null } : {}),
    },
  });

  if (emailChanged) {
    const token = await createVerificationToken(
      email,
      VerificationTokenType.email_verification,
    );
    await sendVerificationEmail(email, token);
  }

  revalidatePath("/parametres");
  return {
    status: "success",
    message: emailChanged
      ? "Profil mis à jour. Vérifiez votre nouvelle adresse email."
      : "Profil mis à jour.",
  };
}

// ── Changement de mot de passe ───────────────────────────────────────────────
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const account = await requireAccount();

  const parsed = changePasswordSchema.safeParse({
    // Champ désactivé (compte Google-only) → absent du FormData (null).
    currentPassword: formData.get("currentPassword")?.toString() ?? "",
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Compte Google-only sans mot de passe : on autorise à en définir un sans
  // exiger d'ancien mot de passe.
  if (account.passwordHash) {
    const valid = await verifyPassword(
      parsed.data.currentPassword,
      account.passwordHash,
    );
    if (!valid) {
      return {
        status: "error",
        fieldErrors: { currentPassword: ["Mot de passe actuel incorrect"] },
      };
    }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash },
  });

  return { status: "success", message: "Mot de passe mis à jour." };
}
