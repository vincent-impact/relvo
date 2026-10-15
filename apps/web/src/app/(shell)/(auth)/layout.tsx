import { RelvoLogo } from "@/components/layout/relvo-logo";

// Tunnel d'authentification (M9.23, Direction B) — hero violet de marque +
// carte blanche « à cheval » (overlap), à l'image des écrans de l'app.
//
// PWA (statut iOS black-translucent) : la webview occupe tout l'écran, l'heure
// s'affiche par-dessus le hero. On cale donc le contenu sous la status bar via
// `max(env(safe-area-inset-top), …)`, et on réserve le bas via
// `env(safe-area-inset-bottom)`. Le bandeau violet fixe global (layout racine)
// garde l'heure lisible.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Le ciel haut (design-system/01-tokens) : près de la moitié de l'écran,
          le signe de Relvo flotte au milieu des étoiles, la carte chevauche
          la frontière. */}
      <div
        className="ciel overflow-hidden px-6 pb-[100px]"
        style={{
          background: "var(--ciel-haut)",
          paddingTop: "max(env(safe-area-inset-top), 56px)",
        }}
      >
        <div className="flex flex-col items-center pt-6 text-center">
          <RelvoLogo size={72} variant="mark" className="text-white" />
          <span className="mt-8 font-heading text-[40px] leading-none font-semibold tracking-[-0.02em] text-white">
            Relvo
          </span>
          <p className="mt-2 text-[14px] font-light text-white/90">
            Vos messages deviennent des affaires
          </p>
        </div>
      </div>

      <main className="relative z-1 mx-auto -mt-[78px] w-full max-w-sm flex-1 px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
        {children}
      </main>
    </div>
  );
}
