import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/server/auth-context";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accédez à votre espace Relvo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled && (
          <>
            <GoogleButton label="Continuer avec Google" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-primary hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
