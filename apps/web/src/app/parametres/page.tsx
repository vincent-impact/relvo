import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Paramètres — Relvo" };

export default async function ParametresPage() {
  const account = await requireAccount();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ← Accueil
        </Link>
      </div>

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
        </TabsContent>
      </Tabs>
    </main>
  );
}
