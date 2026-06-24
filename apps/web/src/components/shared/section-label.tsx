import Link from "next/link";

// En-tête de section (Direction B, cf. .sect) : pastille de couleur + titre fort
// + lien d'action optionnel (« Tout voir »). Gère sa propre gouttière horizontale.

export function SectionLabel({
  title,
  href,
  linkLabel = "Tout voir",
  dotColor = "var(--brand)",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  /** Couleur de la pastille (domaine / signal). */
  dotColor?: string;
}) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-6 pb-2">
      <span className="flex items-center gap-2 text-[16.5px] font-extrabold tracking-[-0.3px] whitespace-nowrap">
        <span
          className="size-[7px] flex-none rounded-full"
          style={{ background: dotColor }}
        />
        {title}
      </span>
      {href ? (
        <Link
          href={href}
          className="text-[13.5px] font-bold whitespace-nowrap text-brand"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
