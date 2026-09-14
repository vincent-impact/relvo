import { Geist, Geist_Mono } from "next/font/google";

// Polices communes aux DEUX layouts racine — `(shell)` (l'application) et
// `(public)` (les pages vues hors de l'application). Un seul chargement, une
// seule définition des variables CSS (`--font-geist-sans`, `--font-geist-mono`)
// que `globals.css` et les feuilles scopées consomment.
//
// Direction « Instrument » (2026-09) : UNE seule famille. Bricolage Grotesque
// (ex `--font-display`) est retirée — ses formes expressives donnaient le ton
// « ludique » ; les titres sont en Geist 600, interlettrage -0.02em.
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

export const fontClassNames = `${geistSans.variable} ${geistMono.variable}`;
