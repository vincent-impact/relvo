import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeVerificationToken } from "@/lib/tokens";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerificationTokenType } from "@relvo/db";

export const metadata: Metadata = { title: "Vérification de l'email — Relvo" };

export default async function VerifierEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let verified = false;
  if (token) {
    const email = await consumeVerificationToken(
      token,
      VerificationTokenType.email_verification,
    );
    if (email) {
      // updateMany : ne lève pas si le compte n'existe pas/plus.
      await prisma.account.updateMany({
        where: { email },
        data: { emailVerified: new Date() },
      });
      verified = true;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {verified ? "Email vérifié" : "Lien invalide ou expiré"}
        </CardTitle>
        <CardDescription>
          {verified
            ? "Votre adresse email a bien été confirmée."
            : "Ce lien de vérification est invalide ou a expiré."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          Accéder à Relvo
        </Link>
      </CardContent>
    </Card>
  );
}
