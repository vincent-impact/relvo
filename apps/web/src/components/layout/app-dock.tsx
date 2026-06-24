import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { RelvoComposer } from "@/components/layout/relvo-composer";

// Dock « Liquid Glass » (Direction B) — ancré au bas du cadre, il CHEVAUCHE le
// contenu scrollé : tab bar givrée translucide au-dessus du composer violet.
// Le contenu défile dessous (effet verre). Le padding-bas du <Screen> réserve
// la hauteur du dock.

export function AppDock() {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ boxShadow: "var(--shadow-dock)" }}
    >
      <BottomTabBar />
      <RelvoComposer />
    </div>
  );
}
