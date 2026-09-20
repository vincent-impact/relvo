import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MenuButton } from "@/components/layout/side-menu";
import { cn } from "@/lib/utils";

// RelvoHeader — la « zone agent » violette en tête de chaque écran (Direction B).
// Deux modes : page principale (bouton MENU à gauche, grand titre) ou écran
// poussé (flèche retour + titre). À DROITE : le slot `action`, qui sert le
// CONTEXTE de la page (ex. « + » Nouveau sujet sur Sujets). L'accès à Relvo
// n'est PLUS dans le header : il est au centre de la barre d'onglets, sous le
// pouce (invariant 35). `children` loge le brief, la carte métriques, un
// segmented… Le header SCROLLE avec le contenu.
//
// Direction « Instrument » (2026-09) : violet ENCRE, rayon bas plafonné
// (--hero-round = 20px), un GRAIN discret (`.grain`) à la place du halo — c'est
// ce qui fait « matière » plutôt qu'aplat plastique — et des titres en Geist 600
// interlettrage -0.02em (plus d'extrabold : le sérieux vient de la retenue).

// Bouton de verre du header (retour, menu) : 38px, blanc translucide, filet.
const GLASS_BTN =
  "pressable grid size-[38px] flex-none place-items-center rounded-full text-white";
const GLASS_BTN_STYLE = {
  background: "rgb(255 255 255 / 0.14)",
  border: "1px solid rgb(255 255 255 / 0.28)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.25), 0 1px 2px rgb(0 0 0 / 0.18)",
};

export function RelvoHeader({
  title,
  subtitle,
  back,
  action,
  rounded = true,
  wrapTitle = false,
  titleFull = false,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** href du bouton retour (mode « écran poussé »). Sans lui : bouton menu. */
  back?: string;
  /** Action(s) de page, posée(s) à DROITE (optionnel). */
  action?: React.ReactNode;
  rounded?: boolean;
  /** Titre sur 2 lignes (lisible en entier) au lieu de tronqué — mode détail. */
  wrapTitle?: boolean;
  /** Titre affiché EN ENTIER, sans aucune troncature (conversation). */
  titleFull?: boolean;
  /** Brief, MetricsCard, SegTabs, status-strip… logés dans la zone violette. */
  children?: React.ReactNode;
  className?: string;
}) {
  const detail = Boolean(back);
  const right = action ? (
    <div className="flex flex-none items-center gap-2">{action}</div>
  ) : null;
  return (
    <header
      className={cn(
        "grain relative overflow-hidden bg-relvo pb-5 text-white",
        rounded && "rounded-b-(--hero-round)",
        className,
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
    >
      {detail ? (
        <div className="relative z-[1] flex items-center gap-3 px-3.5 pt-0.5 pb-1">
          <Link
            href={back!}
            aria-label="Retour"
            className={GLASS_BTN}
            style={GLASS_BTN_STYLE}
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "font-heading text-[19px] font-semibold tracking-[-0.01em]",
                titleFull
                  ? "leading-[1.2]"
                  : wrapTitle
                    ? "line-clamp-2 leading-[1.15]"
                    : "truncate",
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              // Un titre sur deux lignes colle son sous-titre sans cet air.
              <div className="mt-1.5 truncate text-[12.5px] text-(--on-violet)">
                {subtitle}
              </div>
            ) : null}
          </div>
          {right}
        </div>
      ) : (
        <div className="relative z-[1] flex items-center gap-3 px-3.5 pt-1">
          <MenuButton className={GLASS_BTN} style={GLASS_BTN_STYLE} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-[24px] leading-[1.15] font-semibold tracking-[-0.02em]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 truncate text-[13px] text-(--on-violet)">
                {subtitle}
              </div>
            ) : null}
          </div>
          {right}
        </div>
      )}

      {children ? <div className="relative z-[1]">{children}</div> : null}
    </header>
  );
}
