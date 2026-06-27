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
        // Hauteur = --app-height (vraie hauteur du viewport mesurée en JS, cf.
        // layout.tsx), fallback 100dvh. On N'utilise PAS h-dvh seul : il est
        // instable en PWA Chrome iOS standalone et laisse une bande blanche sous
        // le dock. Le rebond du document est neutralisé en JS (IosScrollLock).
        "relative mx-auto flex w-full max-w-120 flex-col overflow-hidden bg-white sm:border-x sm:border-(--hairline)",
        className,
      )}
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      {children}
    </div>
  );
}
