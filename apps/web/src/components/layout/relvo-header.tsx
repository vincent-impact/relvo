import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MenuButton } from "@/components/layout/side-menu";
import { cn } from "@/lib/utils";

// RelvoHeader — le CIEL en tête de chaque écran (design-system/03-patterns,
// « Le cadre : le ciel en haut, le dock en bas ») : violet nuit, violet de
// Relvo, puis sa lueur, avec son champ d'étoiles (`.ciel`, globals.css). Il ne
// s'arrête jamais net : sa QUEUE (`.ciel-queue`) fond vers le blanc SOUS ce qui
// suit — la première carte, les puces, le bloc de Relvo se posent dessus. La
// queue ne prend pas de hauteur (marge négative) : le fondu dure deux fois
// plus longtemps sans coûter un pixel. Un écran dont le ciel est FIXE (le fil
// d'une conversation, l'échange) pose la queue lui-même en tête de son
// défilement (`tail={false}`) : sinon elle voilerait ce qui défile dessous.
//
// UNE SEULE RANGÉE : [flèche] titre … actions [burger]. Le titre d'une fiche
// ou d'une conversation (`wrapTitle`, `titleFull`) replie sur plusieurs lignes
// DANS SA COLONNE, à droite de la flèche — jamais sous elle : une rangée de
// boutons seule au-dessus du titre coûtait 46 px sur chaque écran poussé
// (retour du dirigeant, M19.10). `eyebrow` est la ligne au-dessus (la date sur
// l'accueil, le domaine sur une fiche), `subtitle` la ligne en dessous, en
// petites capitales.
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
  "truncate text-[12px] font-normal tracking-[0.08em] text-white/90 uppercase";

/** La queue du ciel : à poser en tête du défilement quand le ciel est fixe. */
export function SkyTail({ className }: { className?: string }) {
  return <div aria-hidden className={cn("ciel-queue", className)} />;
}

export function RelvoHeader({
  title,
  eyebrow,
  subtitle,
  back,
  action,
  wrapTitle = false,
  titleFull = false,
  tail = true,
  hero,
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
  /** Titre sur 2 lignes (lisible en entier), à droite de la flèche — fiche d'un sujet. */
  wrapTitle?: boolean;
  /** Titre affiché EN ENTIER, sans aucune troncature, à droite de la flèche (conversation). */
  titleFull?: boolean;
  /** La queue du ciel sous le header. `false` quand le ciel est fixe : l'écran la pose lui-même. */
  tail?: boolean;
  /**
   * Une CARTE DE VISITE centrée (la fiche d'un contact) à la place du titre :
   * la rangée ne porte que la flèche et les actions, `hero` vient dessous et
   * rend son propre h1. `title` reste requis pour le nom de la page.
   */
  hero?: React.ReactNode;
  /** Ce qui vit dans le ciel : nouvelles, indicateurs, segmented, onglets. */
  children?: React.ReactNode;
  className?: string;
}) {
  const pushed = Boolean(back);
  const multiline = wrapTitle || titleFull;

  const h1 = (
    <h1
      className={cn(
        "min-w-0 font-heading font-semibold tracking-[-0.01em] text-white",
        titleFull
          ? "text-[26px] leading-7.5"
          : wrapTitle
            ? "line-clamp-2 text-[28px] leading-8"
            : "flex-1 truncate text-[28px] leading-8.5",
      )}
    >
      {title}
    </h1>
  );

  const buttons = (
    <>
      {action ? (
        // Sous 360 px (pire cas, M19.10), la rangée d'une page à segmented
        // (Calendrier, Bilan) ne laissait au titre que « Cale… » : les
        // actions passent alors sur une ligne à elles, à droite, et le
        // burger reste sur celle du titre.
        <div className="flex flex-none items-center gap-2 max-[359px]:order-last max-[359px]:mt-2 max-[359px]:basis-full max-[359px]:justify-end">
          {action}
        </div>
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
    <>
      <header
        className={cn("ciel overflow-hidden px-4 pb-4", className)}
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 14px)",
        }}
      >
        {hero ? (
          <>
            <div className="flex h-[34px] items-center gap-2">
              {backLink}
              <div className="flex-1" />
              {buttons}
            </div>
            {hero}
          </>
        ) : multiline ? (
          // La flèche et les actions tiennent la première ligne ; le titre
          // replie dans sa colonne, sa ligne du dessus (le domaine) au-dessus.
          <div className="flex items-start gap-2.5">
            {backLink}
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <div className={cn(EYEBROW, "mt-px mb-1")}>{eyebrow}</div>
              ) : null}
              {h1}
            </div>
            {buttons}
          </div>
        ) : (
          <>
            {eyebrow ? (
              <div className={cn(EYEBROW, "mb-1")}>{eyebrow}</div>
            ) : null}
            {/* La rangée : [flèche] titre … actions [burger] — 34 px au moins. */}
            <div className="flex min-h-[34px] flex-wrap items-center gap-2">
              {backLink}
              {h1}
              {buttons}
            </div>
          </>
        )}

        {subtitle ? (
          <div className={cn(EYEBROW, "mt-1")}>{subtitle}</div>
        ) : null}

        {children ? <div className="mt-3">{children}</div> : null}
      </header>
      {tail ? <SkyTail /> : null}
    </>
  );
}
