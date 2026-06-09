import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card>
        <CardHeader>
          <CardTitle>Lien invalide</CardTitle>
          <CardDescription>
            Ce lien de réinitialisation est incomplet ou a expiré.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm font-medium text-primary hover:underline"
          >
            Refaire une demande
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez un nouveau mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
