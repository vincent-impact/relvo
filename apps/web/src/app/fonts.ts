import { Barlow, Barlow_Semi_Condensed } from "next/font/google";

// Polices communes aux DEUX layouts racine — `(shell)` (l'application) et
// `(public)` (les pages vues hors de l'application). Un seul chargement, une
// seule définition des variables CSS (`--font-barlow`, `--font-barlow-condensed`)
// que `globals.css` et les feuilles scopées consomment.
//
// Direction « Lettrage d'artisan » (conception/design-system/01-tokens.md) :
// UNE famille en DEUX dessins. Barlow, dérivée du lettrage routier, fine et
// large, pour le texte (300 courant, 400 titre d'une ligne, 500 libellé qui
// porte) ; Barlow Semi Condensed 600 pour les chiffres, horaires, délais et
// titres — les gros chiffres du camion. Pas de mono : les références et les
// chiffres tabulaires passent par le condensé.
//
// `next/font` auto-héberge les fichiers : rien n'est chargé depuis Google au
// runtime, la PWA les sert comme n'importe quel asset statique.
//
// `next/font` exige un appel au niveau module, affecté à une constante : ce
// fichier n'existe que pour ça.

export const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600"],
});

export const fontClassNames = `${barlow.variable} ${barlowCondensed.variable}`;
