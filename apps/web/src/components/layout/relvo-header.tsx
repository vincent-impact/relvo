import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MenuButton } from "@/components/layout/side-menu";
import { cn } from "@/lib/utils";

// RelvoHeader — le CIEL en tête de chaque écran (design-system/03-patterns,
// « Le cadre : le ciel en haut, le dock en bas ») : violet nuit, violet de
// Relvo, puis le blanc de l'écran de travail, avec son champ d'étoiles (`.ciel`,
// globals.css). Il ne s'arrête jamais net : la première carte le chevauche et
// il fond derrière elle — d'où le rembourrage bas, que `children` consomme.
//
// Deux modes. Page : à gauche `leading` (l'avatar sur l'accueil) ou rien, à
// droite les actions de la page puis le BURGER, discret. Écran poussé (`back`) :
// la flèche retour à gauche, les actions à droite, pas de burger. Le titre est
// gros et condensé (`font-heading`) ; `eyebrow` est la ligne au-dessus (la date
// sur l'accueil), `subtitle` la ligne en dessous, en petites capitales.
// `children` loge ce qui vit dans le ciel : le bloc des nouvelles, une carte
// d'indicateurs, un segmented, les onglets d'une fiche. Le header SCROLLE avec
// le contenu.

// Bouton d'icône posé sur le ciel : 30 px, blanc translucide, rayon 8.
export const SKY_BTN =
  "pressable grid size-[30px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-white/14 text-white";

export function RelvoHeader({
  title,
  eyebrow,
  subtitle,
  back,
  leading,
  action,
  wrapTitle = false,
  titleFull = false,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Ligne au-dessus du titre (la date sur l'accueil). */
  eyebrow?: React.ReactNode;
  /** Ligne sous le titre, en petites capitales. */
  subtitle?: React.ReactNode;
  /** href du bouton retour (mode « écran poussé »). Sans lui : page, avec le burger. */
  back?: string;
  /** Élément à GAUCHE de la rangée des boutons (l'avatar sur l'accueil). */
  leading?: React.ReactNode;
  /** Action(s) de page, posée(s) à DROITE, avant le burger. */
  action?: React.ReactNode;
  /** Titre sur 2 lignes (lisible en entier) au lieu de tronqué — mode détail. */
  wrapTitle?: boolean;
  /** Titre affiché EN ENTIER, sans aucune troncature (conversation). */
  titleFull?: boolean;
  /** Ce qui vit dans le ciel : nouvelles, indicateurs, segmented, onglets. */
  children?: React.ReactNode;
  className?: string;
}) {
  const pushed = Boolean(back);
  return (
    <header
      className={cn("ciel overflow-hidden px-4 pb-4", className)}
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      {/* La rangée des boutons : 34 px de haut, quoi qu'elle porte. */}
      <div className="flex h-[34px] items-center gap-2">
        {pushed ? (
          <Link href={back!} aria-label="Retour" className={SKY_BTN}>
            <ChevronLeft className="size-[18px]" strokeWidth={2.6} />
          </Link>
        ) : (
          leading
        )}
        <div className="flex-1" />
        {action ? (
          <div className="flex flex-none items-center gap-2">{action}</div>
        ) : null}
        {pushed ? null : <MenuButton className={SKY_BTN} />}
      </div>

      <div className={cn("min-w-0", pushed ? "mt-2" : "mt-2.5")}>
        {eyebrow ? (
          <div className="truncate text-[12px] tracking-[0.08em] text-white/90 uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={cn(
            "font-heading font-semibold tracking-[-0.01em] text-white",
            pushed
              ? "text-[28px] leading-[32px]"
              : "text-[30px] leading-[34px]",
            titleFull
              ? "text-[26px] leading-[30px]"
              : wrapTitle
                ? "line-clamp-2"
                : "truncate",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-1 truncate text-[12px] tracking-[0.08em] text-white/90 uppercase">
            {subtitle}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
