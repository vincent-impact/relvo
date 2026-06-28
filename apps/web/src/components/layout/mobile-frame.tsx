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
        "relative mx-auto flex w-full max-w-120 flex-col overflow-hidden bg-white sm:border-x sm:border-(--hairline)",
        className,
      )}
      // Hauteur pilotée par JS en PWA iOS (cf. ViewportHeight) ; `100dvh` = repli
      // SSR/navigateur. Évite le mauvais calcul de `dvh` au lancement standalone.
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      {children}
    </div>
  );
}
