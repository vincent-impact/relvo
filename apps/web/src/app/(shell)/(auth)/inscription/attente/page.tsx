import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Demande notée — Relvo" };

// La porte de l'alpha (M21.6) : l'inscription est libre, l'accès s'ouvre quand
// un administrateur valide la demande. Une page, pas une erreur — la personne
// a fait ce qu'il fallait, c'est à Relvo de revenir vers elle.

export default function AttentePage() {
  return (
    <AuthCard
      title="Votre demande est notée"
      description="Relvo ouvre progressivement. Vous recevrez un e-mail dès que votre accès sera prêt, avec le lien pour vous connecter."
    >
      <p className="text-[14px] leading-[1.45] font-light text-gris">
        En attendant, rien à faire de votre côté : votre adresse et votre mot de
        passe sont enregistrés.
      </p>
      <div className="mt-4">
        <AuthLink href="/connexion">Retour à la connexion</AuthLink>
      </div>
    </AuthCard>
  );
}
