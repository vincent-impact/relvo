import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

// Polices communes aux DEUX layouts racine — `(shell)` (l'application) et
// `(public)` (les pages vues hors de l'application). Un seul chargement, une
// seule définition des variables CSS (`--font-geist-sans`, `--font-geist-mono`,
// `--font-display`) que `globals.css` et les feuilles scopées consomment.
//
// `next/font` exige un appel au niveau module, affecté à une constante : ce
// fichier n'existe que pour ça.

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police display « Direction B » — gros titres (hero, KPI labels, dates jours).
export const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const fontClassNames = `${geistSans.variable} ${geistMono.variable} ${bricolage.variable}`;
