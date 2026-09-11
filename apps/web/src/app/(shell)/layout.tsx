import type { Metadata, Viewport } from "next";
import { LandscapeGuard } from "@/components/layout/landscape-guard";
import { NavVisibilityProvider } from "@/components/layout/nav-visibility";
import { OverscrollGuard } from "@/components/layout/overscroll-guard";
import { ViewportHeight } from "@/components/layout/viewport-height";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { fontClassNames } from "../fonts";
import "../globals.css";

// Layout RACINE de l'APPLICATION — le groupe `(shell)`.
//
// Le dépôt a DEUX layouts racine (groupes de routes) : celui-ci porte la
// « coquille » de l'application — métadonnées PWA, zoom bloqué, verrou portrait,
// hauteur de cadre, garde anti-rebond, session — et `(public)` porte les pages
// vues HORS de l'application (le suivi client), qui ne doivent subir AUCUNE de
// ces contraintes. ⚠️ Le garde anti-rebond annule tout défilement vertical hors
// d'un conteneur scrollable : une page qui défile par le document ne peut PAS
// vivre sous ce layout (PITFALLS #48).

export const metadata: Metadata = {
  title: "Relvo",
  description: "Assistant IA de pilotage des sollicitations professionnelles.",
  applicationName: "Relvo",
  manifest: "/manifest.webmanifest",
  // iOS : déclenche le mode standalone (plein écran) une fois ajouté à l'écran
  // d'accueil DEPUIS SAFARI. Émet <meta name="apple-mobile-web-app-capable">.
  appleWebApp: {
    capable: true,
    title: "Relvo",
    // black-translucent : la webview occupe TOUT l'écran (sous la status bar),
    // le hero violet remonte derrière l'heure (env(safe-area-inset-top) devient
    // non-nul → RelvoHeader se cale dessous). Un bandeau violet fixe (MobileFrame)
    // garde l'heure lisible au scroll.
    statusBarStyle: "black-translucent",
  },
  // Meta standard (Android/Chrome) — Next n'émet que la variante apple via
  // appleWebApp ; on ajoute l'équivalent générique pour coller à la maquette et
  // éviter l'avertissement de dépréciation de Chrome.
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: "/relvo-icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

// themeColor + viewport-fit=cover : couleur de la barre de statut alignée sur le
// hero violet, et activation des env(safe-area-inset-*) déjà utilisés par Screen.
export const viewport: Viewport = {
  themeColor: "#6b5bd6",
  width: "device-width",
  initialScale: 1,
  // Zoom BLOQUÉ : le pinch-zoom et le zoom au focus d'un input changent la taille
  // du viewport (donc la hauteur du cadre) → source du décalage. On fige l'échelle.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // ANDROID — clavier virtuel. Par défaut (`resizes-visual`), Chrome rétrécit le
  // viewport VISUEL mais laisse `innerHeight` à pleine hauteur : le cadre reste
  // donc plein, et nos docks en `absolute bottom-0` (composer de réponse, dock
  // de triage) se retrouvent DERRIÈRE le clavier — Chrome les remonte à moitié
  // en faisant défiler le champ focalisé, d'où le composer rogné de quelques px.
  // `resizes-content` fait suivre le viewport de MISE EN PAGE : `bottom-0` se
  // pose alors naturellement au-dessus du clavier. iOS ignore la propriété — son
  // comportement (géré par ViewportHeight) est inchangé.
  interactiveWidget: "resizes-content",
};

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fontClassNames} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Bandeau violet fixe derrière la status bar (standalone iOS, statut
            black-translucent) : garde l'heure/batterie lisibles partout, y
            compris quand du contenu blanc scrolle dessous. Hauteur =
            safe-area-inset-top → 0 hors standalone (invisible en navigateur). */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-relvo"
          style={{ height: "env(safe-area-inset-top)" }}
        />
        <ViewportHeight />
        <OverscrollGuard />
        <LandscapeGuard />
        <Providers>
          <NavVisibilityProvider>{children}</NavVisibilityProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
