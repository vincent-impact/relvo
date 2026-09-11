import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — Relvo",
};

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="Lien invalide"
        description="Ce lien de réinitialisation est incomplet ou a expiré."
      >
        <AuthLink href="/mot-de-passe-oublie">Refaire une demande</AuthLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      description="Choisissez un nouveau mot de passe."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
