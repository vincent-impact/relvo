import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Mot de passe oublié — Relvo" };

export default function MotDePasseOubliePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Saisissez votre email pour recevoir un lien de réinitialisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/connexion"
            className="font-medium text-primary hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
