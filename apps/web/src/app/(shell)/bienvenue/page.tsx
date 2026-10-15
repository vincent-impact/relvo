import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Diapositives } from "@/components/bienvenue/diapositives";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Bienvenue — Relvo" };

// La première connexion (01 §11, 05 §11.11, M19.9) : cinq diapositives à
// glisser qui disent ce que Relvo fait — du contexte, pas un mode d'emploi —,
// puis l'invitation à connecter sa première adresse e-mail. Vues une seule
// fois : la trace est sur le compte (`welcome_seen_at`), et le chrome de
// l'application (`(app)/layout`) envoie ici tant qu'elle n'est pas posée.
// L'échange scripté (M10.16) reste la prise en main : il commence à la
// connexion du canal, les diapositives y conduisent.
//
// Plein écran, HORS du groupe (app) : pas de dock — il n'y a encore rien à
// quoi aller, et on ne présente pas une barre d'onglets avant d'avoir dit à
// quoi elle sert.

export default async function BienvenuePage() {
  const account = await requireAccount();
  if (account.welcomeSeenAt) redirect("/");
  return <Diapositives firstName={account.firstName} />;
}
