import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// RelvoHeader — la « zone agent » violette en tête de chaque écran (Direction B).
// Deux modes : page principale (grand titre) ou écran poussé (flèche retour +
// titre). Le slot droit `action` sert le CONTEXTE de la page ouverte (ex. sur la
// fiche Sujet : Ignorer/Terminer). L'accès à l'historique des conversations
// Relvo vit en bas à gauche du composer, pas ici. `children` loge le brief, la
// carte métriques, un segmented… Le header SCROLLE avec le contenu ; le dock
// Liquid Glass du bas, lui, est ancré et chevauche le contenu.

export function RelvoHeader({
  title,
  subtitle,
  back,
  action,
  rounded = true,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** href du bouton retour (mode « écran poussé »). */
  back?: string;
  /** Action(s) de droite servant le contexte de la page (optionnel). */
  action?: React.ReactNode;
  rounded?: boolean;
  /** Brief, MetricsCard, SegTabs, status-strip… logés dans la zone violette. */
  children?: React.ReactNode;
  className?: string;
}) {
  const detail = Boolean(back);
  return (
    <header
      className={cn(
        "relative overflow-hidden bg-relvo pb-5 text-white",
        rounded && "rounded-b-(--hero-round)",
        className,
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
    >
      {/* halo lumineux haut-droite */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[70px] -right-[50px] size-60 rounded-full"
        style={{
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
            <h1 className="truncate font-heading text-[19px] font-extrabold tracking-[-0.3px]">
              {title}
            </h1>
            {subtitle ? (
              <div className="truncate text-[12.5px] text-(--on-violet)">
                {subtitle}
              </div>
            ) : null}
          </div>
          {action}
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
          {action}
        </div>
      )}

      {children ? <div className="relative z-[1]">{children}</div> : null}
    </header>
  );
}
