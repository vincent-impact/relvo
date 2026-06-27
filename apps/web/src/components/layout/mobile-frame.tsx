import { cn } from "@/lib/utils";

// Cadre mobile commun (colonne unique pleine hauteur, centrée et bordée sur
// grand écran). Partagé par le chrome (app) à onglets ET les surfaces plein
// écran (Sujet, conversation) qui composent leur propre bas de page.

export function MobileFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // h-full (et non h-dvh) : le <body> est épinglé en position fixed = plein
        // écran (cf. globals.css). Le cadre prend 100% de ce body → il coïncide
        // pile avec le viewport, sans la bande blanche que laissait l'écart entre
        // dvh (plus court en standalone iOS) et le body plein écran.
        "relative mx-auto flex h-full w-full max-w-120 flex-col overflow-hidden bg-white sm:border-x sm:border-(--hairline)",
        className,
      )}
    >
      {children}
    </div>
  );
}
