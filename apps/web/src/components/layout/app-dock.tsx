import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

// Dock bas (Direction B) — désormais la SEULE barre d'onglets, violette et fixe,
// ancrée au bas du cadre. L'ancien composer Relvo persistant a été retiré :
// l'accès à Relvo vit en haut à droite du header (cf. RelvoHeaderButton). Le
// padding-bas du <Screen> réserve la hauteur de la barre.

export function AppDock() {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ boxShadow: "var(--shadow-dock)" }}
    >
      <BottomTabBar />
    </div>
  );
}
