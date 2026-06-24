import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { NavVisibilityProvider } from "@/components/layout/nav-visibility";
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
    statusBarStyle: "default",
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
        <Providers>
          <NavVisibilityProvider>{children}</NavVisibilityProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
