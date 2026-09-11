import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/server/auth-context";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion — Relvo" };

const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export default async function ConnexionPage() {
  // Déjà connecté (compte réel en base, pas seulement un JWT) → pas de page de
  // connexion. On vérifie l'existence du compte pour éviter une boucle de
  // redirection si le JWT pointe vers un compte supprimé.
  if (await getCurrentAccount()) redirect("/");

  return (
    <AuthCard title="Connexion" description="Accédez à votre espace Relvo.">
      <div className="space-y-4">
        {googleEnabled && (
          <>
            <GoogleButton label="Continuer avec Google" />
            <div className="flex items-center gap-3 text-[12px] text-(--text-tertiary)">
              <span className="h-px flex-1 bg-(--border-light)" />
              ou
              <span className="h-px flex-1 bg-(--border-light)" />
            </div>
          </>
        )}
        <LoginForm />
        <AuthLink href="/inscription" prefix="Pas encore de compte ?">
          Créer un compte
        </AuthLink>
      </div>
    </AuthCard>
  );
}
