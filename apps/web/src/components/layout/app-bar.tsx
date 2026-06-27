"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useNavScroll } from "@/components/layout/nav-visibility";
import { cn } from "@/lib/utils";

// En-tête de page mobile (cf. .appbar du mockup). Hauteur fixe, ne scrolle pas.
// `back` ajoute une flèche retour ; `action` reçoit un élément à droite
// (bouton recherche, accès Relvo, menu…).

export function AppBar({
  title,
  subtitle,
  back,
  leading,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** href du bouton retour (flèche ‹). */
  back?: string;
  /** Élément optionnel avant les titres (avatar de contact, etc.). */
  leading?: React.ReactNode;
  /** Élément optionnel à droite (action d'en-tête). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-none items-center gap-2.5 border-b border-(--border-light) bg-white px-4 py-2.5",
        className,
      )}
    >
      {back ? (
        <Link
          href={back}
          aria-label="Retour"
          className="-ml-1 grid h-8 w-8 flex-none place-items-center text-xl text-muted-foreground"
        >
          <ChevronLeft className="size-6" />
        </Link>
      ) : null}
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[18px] leading-tight font-bold tracking-[-0.2px]">
          {title}
        </div>
        {subtitle ? (
          <div className="truncate text-[12.5px] text-(--text-tertiary)">
            {subtitle}
          </div>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/**
 * Conteneur scrollable d'une page (cf. .scroll + .scroll-pad du mockup). Pilote
 * le masquage de la barre d'onglets : remonte sa position de scroll au contexte
 * de visibilité et réinitialise l'état à chaque changement de page.
 */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { onScroll, reset } = useNavScroll();
  useEffect(() => reset(), [reset]);
  return (
    <main
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-(--surface)"
    >
      <div className={cn("px-4 pt-3.5 pb-3.5", className)}>{children}</div>
    </main>
  );
}
