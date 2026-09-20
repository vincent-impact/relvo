import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { DEMO_EMAIL } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ResetDemoButton } from "@/components/settings/reset-demo-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutAction } from "@/server/actions/auth";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Profil — Relvo" };

// Profil — page du menu (M18) : identité, mot de passe, session. Les anciens
// Réglages à onglets n'existent plus : Canaux, Profil, Préférences et Usage
// sont quatre pages à part entière, chacune avec son burger.

// Le reset du compte démo (Server Action invoquée depuis cette page) recrée
// beaucoup d'objets (29 sujets + 115 tâches + journaux) → on relève le plafond
// de durée de la fonction serverless pour éviter un timeout (clampé au max du
// plan Vercel). Fluid Compute autorise des durées longues.
export const maxDuration = 300;

export default async function ProfilPage() {
  const account = await requireAccount();

  return (
    <Screen>
      <RelvoHeader title="Profil" subtitle="Votre compte" className="pb-5" />
      <div className="space-y-5 px-4 pt-5">
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Modifiez votre nom et votre adresse email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaultValues={{
                firstName: account.firstName,
                lastName: account.lastName,
                email: account.email,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mot de passe</CardTitle>
            <CardDescription>
              {account.passwordHash
                ? "Changez votre mot de passe."
                : "Définissez un mot de passe pour vous connecter sans Google."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm hasPassword={Boolean(account.passwordHash)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>
              Connecté en tant que {account.email}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full border-(--red-200) text-(--red-600) hover:bg-(--red-50) hover:text-(--red-600)"
              >
                <LogOut className="size-4" />
                Se déconnecter
              </Button>
            </form>
            {account.email === DEMO_EMAIL ? <ResetDemoButton /> : null}
          </CardContent>
        </Card>
      </div>
    </Screen>
  );
}
