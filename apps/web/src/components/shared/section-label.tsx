import Link from "next/link";

// En-tête de section (Direction B) : libellé en petites capitales sourdes —
// volontairement d'un AUTRE registre que les titres de sujet (gras, grande
// taille), pour ne pas brouiller la hiérarchie. Lien d'action optionnel
// (« Tout voir »). Gère sa propre gouttière horizontale.

export function SectionLabel({
  title,
  href,
  linkLabel = "Tout voir",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between px-[22px] pt-6 pb-2.5">
      <span className="text-[12.5px] font-bold tracking-[0.6px] whitespace-nowrap text-(--text-tertiary) uppercase">
        {title}
      </span>
      {href ? (
        <Link
          href={href}
          className="text-[13px] font-bold whitespace-nowrap text-brand"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
