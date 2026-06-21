import Link from "next/link";

// En-tête de section du brief / des listes (cf. .section-label du mockup) :
// titre en petites capitales + lien d'action optionnel à droite.

export function SectionLabel({
  title,
  href,
  linkLabel,
  count,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  count?: number;
}) {
  return (
    <div className="mt-[18px] mb-2 flex items-center justify-between px-0.5 first:mt-1">
      <h2 className="text-[13px] font-bold tracking-[0.5px] text-(--text-tertiary) uppercase">
        {title}
        {typeof count === "number" ? (
          <span className="ml-1 font-semibold text-(--text-tertiary)">
            {count}
          </span>
        ) : null}
      </h2>
      {href && linkLabel ? (
        <Link href={href} className="text-[13px] font-semibold text-brand">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
