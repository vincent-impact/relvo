import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { requireAccount } from "@/server/auth-context";

// Accueil provisoire (M2) : prouve l'authentification + l'isolation tenant.
// La vraie page Accueil (brief matinal) sera construite en M9.
export default async function HomePage() {
  const account = await requireAccount();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Bienvenue</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {account.firstName} {account.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">{account.email}</p>
        {!account.emailVerified && (
          <p className="mt-2 inline-block rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
            Email non vérifié — pensez à confirmer votre adresse.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/parametres"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Paramètres
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost">
            Se déconnecter
          </Button>
        </form>
      </div>
    </main>
  );
}
