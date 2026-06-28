import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { NavVisibilityProvider } from "@/components/layout/nav-visibility";
import { OverscrollGuard } from "@/components/layout/overscroll-guard";
import { ViewportHeight } from "@/components/layout/viewport-height";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police display « Direction B » — gros titres (hero, KPI labels, dates jours).
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
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
        <Providers>
          <NavVisibilityProvider>{children}</NavVisibilityProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
