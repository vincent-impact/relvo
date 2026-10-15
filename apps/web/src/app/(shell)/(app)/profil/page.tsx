import type { Metadata } from "next";
import { DEMO_EMAIL } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ResetDemoButton } from "@/components/settings/reset-demo-button";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Profil — Relvo" };

// Profil — deux cartes à lignes, nommées par un libellé : le compte, le mot de
// passe. Pas de description sous le titre (les champs le disent), pas de carte
// « Session » : l'e-mail est dans le champ, et « Se déconnecter » vit au pied
// du menu, son seul exemplaire. La réinitialisation du compte de démonstration
// est une commande de démonstration : en pied de page, pas une carte du
// produit.

// La réinitialisation de la démo rejoue le seed complet (R2 compris).
export const maxDuration = 300;

const CARTE =
  "relative z-3 mx-4 rounded-(--rayon-carte) border border-(--filet) bg-white px-4 pt-3.5 pb-4 shadow-carte";

export default async function ProfilPage() {
  const account = await requireAccount();

  return (
    <Screen>
      <RelvoHeader title="Profil" subtitle="Votre compte" className="pb-9" />
      <div className="-mt-5 space-y-4">
        <section className={CARTE}>
          <div className="libelle mb-3">Vous</div>
          <ProfileForm
            defaultValues={{
              firstName: account.firstName,
              lastName: account.lastName,
              email: account.email,
            }}
          />
        </section>

        <section className={CARTE}>
          <div className="libelle mb-3">Mot de passe</div>
          {account.passwordHash ? null : (
            <p className="mb-3 text-[14px] leading-5 font-light text-gris">
              Définissez un mot de passe pour vous connecter sans Google.
            </p>
          )}
          <PasswordForm hasPassword={Boolean(account.passwordHash)} />
        </section>

        {account.email === DEMO_EMAIL ? (
          <div className="px-4 pt-2">
            <ResetDemoButton />
          </div>
        ) : null}
      </div>
    </Screen>
  );
}
