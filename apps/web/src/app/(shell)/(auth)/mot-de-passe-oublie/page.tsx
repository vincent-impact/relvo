import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Mot de passe oublié — Relvo" };

export default function MotDePasseOubliePage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Saisissez votre email pour recevoir un lien de réinitialisation."
    >
      <div className="space-y-4">
        <ForgotPasswordForm />
        <AuthLink href="/connexion">Retour à la connexion</AuthLink>
      </div>
    </AuthCard>
  );
}
