import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoComposer } from "@/components/layout/relvo-composer";
import { requireAccount } from "@/server/auth-context";

// Chrome mobile-first commun aux vues structurées (cf. ux-mobile-first §2/§3).
// Colonne unique pleine hauteur : en-tête + corps scrollable (fournis par chaque
// page) → composer Relvo persistant → barre d'onglets basse. Les conversations
// plein écran (/conversation, /conversations) vivent HORS de ce groupe.
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

  return (
    <MobileFrame>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <RelvoComposer />
      <BottomTabBar />
    </MobileFrame>
  );
}
