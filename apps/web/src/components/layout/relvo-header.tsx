import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RelvoHeaderButton } from "@/components/layout/relvo-header-button";
import { cn } from "@/lib/utils";

// RelvoHeader — la « zone agent » violette en tête de chaque écran (Direction B).
// Deux modes : page principale (grand titre) ou écran poussé (flèche retour +
// titre). À DROITE : le bouton d'accès à Relvo (toujours présent, sauf `relvo=
// false`), précédé du slot `action` qui sert le CONTEXTE de la page (ex. « + »
// Nouveau sujet sur Mon fil). `children` loge le brief, la carte métriques, un
// segmented… Le header SCROLLE avec le contenu.

export function RelvoHeader({
  title,
  subtitle,
  back,
  action,
  relvo = true,
  rounded = true,
  wrapTitle = false,
  titleFull = false,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** href du bouton retour (mode « écran poussé »). */
  back?: string;
  /** Action(s) de page, posée(s) à GAUCHE du bouton Relvo (optionnel). */
  action?: React.ReactNode;
  /** Affiche le bouton d'accès à Relvo (défaut true ; false dans la conversation). */
  relvo?: boolean;
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
  // Cluster droit : action(s) de page puis bouton Relvo (extrême droite).
  const right =
    action || relvo ? (
      <div className="flex flex-none items-center gap-2">
        {action}
        {relvo ? <RelvoHeaderButton /> : null}
      </div>
    ) : null;
  return (
    <header
      className={cn(
        "relative overflow-hidden bg-relvo pb-5 text-white",
        rounded && "rounded-b-(--hero-round)",
        className,
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
    >
      {/* Halo lumineux côté droit. Volontairement décalé vers le BAS (centre ~y+50
          plutôt que sous la status bar) : le bord haut du header reste un violet
          plat identique au themeColor, sans couture visible avec la barre d'état. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[50px] size-60 rounded-full"
        style={{
          top: "max(env(safe-area-inset-top), 14px)",
          background:
            "radial-gradient(circle, rgb(255 255 255 / 0.18), transparent 70%)",
        }}
      />

      {detail ? (
        <div className="relative z-[1] flex items-center gap-3 px-3.5 pt-0.5 pb-1">
          <Link
            href={back!}
            aria-label="Retour"
            className="grid size-[38px] flex-none place-items-center rounded-full active:scale-95"
            style={{ background: "rgb(255 255 255 / 0.16)" }}
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "font-heading text-[19px] font-extrabold tracking-[-0.3px]",
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
              <div className="truncate text-[12.5px] text-(--on-violet)">
                {subtitle}
              </div>
            ) : null}
          </div>
          {right}
        </div>
      ) : (
        <div className="relative z-[1] flex items-center justify-between gap-3 px-[22px] pt-1">
          <div className="min-w-0">
            <h1 className="font-heading text-[27px] leading-tight font-extrabold tracking-[-0.6px]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 text-[13.5px] text-(--on-violet)">
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
