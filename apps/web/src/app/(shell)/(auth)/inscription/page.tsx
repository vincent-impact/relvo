import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/server/auth-context";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Créer un compte — Relvo" };

const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export default async function InscriptionPage() {
  // Déjà connecté (compte réel en base) → pas de page d'inscription. Évite la
  // boucle de redirection si le JWT pointe vers un compte supprimé.
  if (await getCurrentAccount()) redirect("/");

  return (
    <AuthCard
      title="Créer un compte"
      description="Quelques secondes pour démarrer avec Relvo."
    >
      <div className="space-y-4">
        {googleEnabled && (
          <>
            <GoogleButton label="S'inscrire avec Google" />
            <div className="flex items-center gap-3 text-[12px] text-(--text-tertiary)">
              <span className="h-px flex-1 bg-(--border-light)" />
              ou
              <span className="h-px flex-1 bg-(--border-light)" />
            </div>
          </>
        )}
        <SignupForm />
        <AuthLink href="/connexion" prefix="Déjà inscrit ?">
          Se connecter
        </AuthLink>
      </div>
    </AuthCard>
  );
}
