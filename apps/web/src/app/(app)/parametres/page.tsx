import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { DEMO_EMAIL } from "@relvo/db";
import { AppBar, PageBody } from "@/components/layout/app-bar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logoutAction } from "@/server/actions/auth";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Paramètres — Relvo" };

// NB : refonte complète en 3 onglets (Profil / Canaux / Contacts) = M9.12 (Phase B).
// Ici on intègre seulement la page existante au chrome mobile-first.
export default async function ParametresPage() {
  const account = await requireAccount();

  return (
    <>
      <AppBar title="Réglages" subtitle="Compte, canaux, contacts" />
      <PageBody>
        <Tabs defaultValue="profil">
          <TabsList>
            <TabsTrigger value="profil">Profil</TabsTrigger>
            {/* Canaux (M5) et Contacts (M9) arriveront avec leurs modules. */}
            <TabsTrigger value="canaux" disabled>
              Canaux
            </TabsTrigger>
            <TabsTrigger value="contacts" disabled>
              Contacts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profil" className="space-y-6 pt-4">
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
                  <Button type="submit" variant="outline" className="w-full">
                    <LogOut className="size-4" />
                    Se déconnecter
                  </Button>
                </form>
                {account.email === DEMO_EMAIL ? <ResetDemoButton /> : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
