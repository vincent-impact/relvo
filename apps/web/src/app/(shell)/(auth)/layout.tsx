import Image from "next/image";

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
    <div className="flex min-h-screen flex-col bg-relvo-bg">
      <div
        className="relative overflow-hidden rounded-b-(--hero-round) bg-relvo px-6 pb-[68px] text-white"
        style={{ paddingTop: "max(env(safe-area-inset-top), 32px)" }}
      >
        {/* halo lumineux (cohérent avec RelvoHeader) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[70px] -right-[50px] size-60 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(255 255 255 / 0.18), transparent 70%)",
          }}
        />
        <div className="relative z-[1] flex flex-col items-center pt-7 text-center">
          <span
            className="grid size-16 place-items-center rounded-2xl"
            style={{
              background: "rgb(255 255 255 / 0.15)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
            }}
          >
            <Image
              src="/relvo-icon.png"
              alt="Relvo"
              width={40}
              height={40}
              priority
              style={{ filter: "drop-shadow(0 2px 6px rgb(0 0 0 / 0.28))" }}
            />
          </span>
          <span className="mt-3 font-heading text-[28px] leading-none font-extrabold tracking-[-0.6px]">
            Relvo
          </span>
          <p className="mt-2 text-[13.5px] text-(--on-violet)">
            Votre assistant de pilotage des sollicitations
          </p>
        </div>
      </div>

      <main className="relative z-[1] mx-auto -mt-12 w-full max-w-sm flex-1 px-4 pb-[max(env(safe-area-inset-bottom),24px)]">
        {children}
      </main>
    </div>
  );
}
