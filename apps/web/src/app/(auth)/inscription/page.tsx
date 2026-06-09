import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/server/auth-context";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Créer un compte — Relvo" };

const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export default async function InscriptionPage() {
  // Déjà connecté (compte réel en base) → pas de page d'inscription. Évite la
  // boucle de redirection si le JWT pointe vers un compte supprimé.
  if (await getCurrentAccount()) redirect("/");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>
          Quelques secondes pour démarrer avec Relvo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled && (
          <>
            <GoogleButton label="S'inscrire avec Google" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-primary hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
