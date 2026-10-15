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
// UNE SEULE RANGÉE : le titre de la page, gros et condensé, et à sa droite les
// actions de la page puis le BURGER, discret. Sur un écran poussé (`back`), la
// flèche retour précède le titre et il n'y a pas de burger. Le titre d'une
// fiche ou d'une conversation (`wrapTitle`, `titleFull`) est trop long pour
// partager la rangée : il descend sous la flèche. `eyebrow` est la ligne
// au-dessus (la date sur l'accueil, le domaine sur une fiche), `subtitle` la
// ligne en dessous, en petites capitales.
//
// La rangée respire sous la barre d'état du téléphone : la zone sûre, plus une
// marge — sans elle, le titre et les boutons se collent à l'heure et à la
// batterie, et le ciel étouffe.
//
// `children` loge ce qui vit dans le ciel : le bloc des nouvelles, une carte
// d'indicateurs, un segmented, les onglets d'une fiche. Le header SCROLLE avec
// le contenu.

// Bouton d'icône posé sur le ciel : 30 px, blanc translucide, rayon 8. Sa zone
// de frappe fait 44 px (03-patterns, « cible tactile minimale ») par un
// pseudo-élément qui déborde de 7 px tout autour, sans grossir le dessin.
export const SKY_BTN =
  "pressable relative grid size-[30px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-white/14 text-white before:absolute before:-inset-[7px] before:content-['']";

const EYEBROW =
  "truncate text-[12px] tracking-[0.08em] text-white/90 uppercase";

export function RelvoHeader({
  title,
  eyebrow,
  subtitle,
  back,
  action,
  wrapTitle = false,
  titleFull = false,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Ligne au-dessus du titre (la date sur l'accueil, le domaine sur une fiche). */
  eyebrow?: React.ReactNode;
  /** Ligne sous le titre, en petites capitales. */
  subtitle?: React.ReactNode;
  /** href du bouton retour (mode « écran poussé »). Sans lui : page, avec le burger. */
  back?: string;
  /** Action(s) de page, posée(s) à DROITE, avant le burger. */
  action?: React.ReactNode;
  /** Titre sur 2 lignes (lisible en entier), sous la flèche — fiche d'un sujet. */
  wrapTitle?: boolean;
  /** Titre affiché EN ENTIER, sans aucune troncature, sous la flèche (conversation). */
  titleFull?: boolean;
  /** Ce qui vit dans le ciel : nouvelles, indicateurs, segmented, onglets. */
  children?: React.ReactNode;
  className?: string;
}) {
  const pushed = Boolean(back);
  // Un titre long ne partage pas la rangée : il descend sous les boutons.
  const titleBelow = wrapTitle || titleFull;

  const h1 = (
    <h1
      className={cn(
        "font-heading font-semibold tracking-[-0.01em] text-white",
        titleFull
          ? "text-[26px] leading-7.5"
          : wrapTitle
            ? "line-clamp-2 text-[28px] leading-8"
            : "min-w-0 flex-1 truncate text-[28px] leading-8.5",
      )}
    >
      {title}
    </h1>
  );

  const buttons = (
    <>
      {action ? (
        <div className="flex flex-none items-center gap-2">{action}</div>
      ) : null}
      {pushed ? null : <MenuButton className={SKY_BTN} />}
    </>
  );

  const backLink = pushed ? (
    <Link href={back!} aria-label="Retour" className={SKY_BTN}>
      <ChevronLeft className="size-[18px]" strokeWidth={2.6} />
    </Link>
  ) : null;

  return (
    <header
      className={cn("ciel overflow-hidden px-4 pb-4", className)}
      style={{
        paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 14px)",
      }}
    >
      {titleBelow ? (
        <>
          {/* La rangée des boutons seule, 34 px ; le titre long en dessous,
              avec sa ligne du dessus (le domaine d'une fiche). */}
          <div className="flex h-[34px] items-center gap-2">
            {backLink}
            <div className="flex-1" />
            {buttons}
          </div>
          {eyebrow ? (
            <div className={cn(EYEBROW, "mt-3 mb-1")}>{eyebrow}</div>
          ) : null}
          <div className={cn("min-w-0", eyebrow ? "" : "mt-2")}>{h1}</div>
        </>
      ) : (
        <>
          {eyebrow ? (
            <div className={cn(EYEBROW, "mb-1")}>{eyebrow}</div>
          ) : null}
          {/* La rangée : [flèche] titre … actions [burger] — 34 px au moins. */}
          <div className="flex min-h-[34px] items-center gap-2">
            {backLink}
            {h1}
            {buttons}
          </div>
        </>
      )}

      {subtitle ? <div className={cn(EYEBROW, "mt-1")}>{subtitle}</div> : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
