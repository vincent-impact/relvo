import { MobileFrame } from "@/components/layout/mobile-frame";
import { requireAdmin } from "@/server/admin";

// La zone d'administration (M21.1) — HORS du groupe `(app)` : pas de dock, pas
// de menu latéral, le même cadre mobile que l'échange plein écran. Le proxy a
// lu le rôle dans le jeton ; ici il est RELU EN BASE à chaque rendu. Chaque
// header de la zone propose le retour à l'application (le pictogramme maison),
// comme le menu de l'application propose le backoffice aux administrateurs.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <MobileFrame>{children}</MobileFrame>;
}
