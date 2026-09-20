import { AppDock } from "@/components/layout/app-dock";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { SideMenu, SideMenuProvider } from "@/components/layout/side-menu";
import { requireAccount } from "@/server/auth-context";

// Chrome mobile-first commun aux vues structurées : colonne unique pleine
// hauteur — en-tête + corps scrollable (fournis par chaque page) — puis la
// barre d'onglets basse, Relvo en son centre. Le menu latéral est rendu ICI,
// une fois ; le bouton burger de chaque header ne fait que l'ouvrir. L'échange
// plein écran avec Relvo (/relvo, /relvo/historique) vit HORS de ce groupe : il
// compose son propre bas de page (le composer), pas de dock.
//
// On centre la colonne à une largeur lisible sur grand écran ; le rail latéral
// desktop (lg) est un enrichissement ultérieur.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Garde-fou tenant (le proxy redirige déjà les anonymes, ceinture + bretelles).
  const account = await requireAccount();

  // Une seule zone de scroll (le <Screen> de chaque page) + dock ancré qui la
  // chevauche. Le hero violet de la page scrolle sous la tab bar givrée.
  return (
    <SideMenuProvider>
      <MobileFrame>
        {children}
        <AppDock />
      </MobileFrame>
      {/* Projection explicite (PITFALLS #41) : jamais l'objet compte entier
          vers un composant client. */}
      <SideMenu
        user={{
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
        }}
      />
    </SideMenuProvider>
  );
}
