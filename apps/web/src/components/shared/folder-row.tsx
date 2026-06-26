import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// FolderRow — un « dossier » de la mémoire en ligne (Direction B) : icône carrée
// colorée par domaine, nom, sous-ligne (n sujets · n documents), chevron.

export function FolderRow({
  name,
  slug,
  color: colorKey,
  icon: iconKey,
  sub,
  href,
}: {
  name: string;
  slug?: string | null;
  color?: string | null;
  icon?: string | null;
  sub?: string | null;
  href: string;
}) {
  const { color, icon: Icon } = folderVisual({
    slug,
    color: colorKey,
    icon: iconKey,
  });
  return (
    <Link
      href={href}
      className="mx-[14px] flex items-center gap-[13px] border-b border-[#f1efeb] px-[18px] py-3.5"
    >
      <span
        className="grid size-[42px] flex-none place-items-center rounded-[13px] text-white"
        style={{ background: color }}
      >
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-bold tracking-[-0.2px]">{name}</div>
        {sub ? (
          <div className={cn("mt-0.5 text-[13px] text-[#86857d]")}>{sub}</div>
        ) : null}
      </div>
      <ChevronRight
        className="size-[18px] flex-none text-[#cfcdc7]"
        strokeWidth={2.4}
      />
    </Link>
  );
}
