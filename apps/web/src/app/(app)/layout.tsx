import { AppDock } from "@/components/layout/app-dock";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { requireAccount } from "@/server/auth-context";

// Chrome mobile-first commun aux vues structurées (cf. ux-mobile-first §2/§3).
// Colonne unique pleine hauteur : en-tête + corps scrollable (fournis par chaque
// page) → composer Relvo persistant → barre d'onglets basse. Les échanges
// plein écran avec Relvo (/relvo, /relvo/historique) vivent HORS de ce groupe.
//
// On centre la colonne à une largeur lisible sur grand écran ; le rail latéral
// desktop (lg) est un enrichissement ultérieur (cf. §8).

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Garde-fou tenant (le proxy redirige déjà les anonymes, ceinture + bretelles).
  await requireAccount();

  // Une seule zone de scroll (le <Screen> de chaque page) + dock ancré qui la
  // chevauche. Le hero violet de la page scrolle sous la tab bar givrée.
  return (
    <MobileFrame>
      {children}
      <AppDock />
    </MobileFrame>
  );
}
