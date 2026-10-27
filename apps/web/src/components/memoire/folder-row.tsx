import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { folderVisual } from "@/lib/folders";
import type { CachedFolderRow } from "@/server/cached";

// La LIGNE d'un dossier de la Mémoire (M23.3) — la même sur la page Mémoire
// (les dossiers de premier niveau) et dans un dossier (ses dossiers) : la
// bande de son premier niveau, son nom, et ce qu'il porte en sous-ligne.

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

// La sous-ligne ne compte que ce qui existe : un zéro dans une phrase n'est
// pas un indicateur de cellule fixe, l'absence du mot dit l'absence de la
// chose. Rien du tout → « rien encore ».
export function folderSub(f: CachedFolderRow): string {
  const parts: string[] = [];
  if (f.children > 0) parts.push(plural(f.children, "dossier"));
  if (f.instructions > 0) parts.push(plural(f.instructions, "instruction"));
  if (f.documents > 0) parts.push(plural(f.documents, "document"));
  if (!f.isDefault && f.openSubjects > 0)
    parts.push(plural(f.openSubjects, "affaire ouverte", "affaires ouvertes"));
  return parts.length ? parts.join(" · ") : "rien encore";
}

export function FolderRow({ folder: f }: { folder: CachedFolderRow }) {
  const { color } = folderVisual({
    slug: f.slug,
    color: f.color,
    icon: f.icon,
  });
  return (
    <Link
      data-list-row
      href={`/memoire/${f.id}`}
      className="flex h-[58px] items-center gap-2.5 border-b border-(--filet) px-3.5 active:bg-(--fond-enfonce)"
    >
      <span aria-hidden className="bande-ligne" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] leading-[18px] font-normal text-noir">
          {f.name}
        </div>
        <div className="truncate text-[12px] leading-[14px] font-normal text-gris">
          {folderSub(f)}
        </div>
      </div>
      <ChevronRight
        className="size-4 flex-none text-(--gris-clair)"
        strokeWidth={2}
      />
    </Link>
  );
}

/** L'invite d'ajout, en bas d'une liste de dossiers — une seule grammaire d'ajout sur l'écran. */
export function AddFolderRow({
  parentId,
  label,
}: {
  /** Le père du dossier à créer ; absent → sous Général. */
  parentId?: string | null;
  label: string;
}) {
  return (
    <Link
      data-list-row
      href={parentId ? `/memoire/nouveau?dans=${parentId}` : "/memoire/nouveau"}
      className="flex items-center gap-2.5 border-b border-(--filet) px-3.5 py-3 text-[14px] font-medium text-relvo active:bg-relvo-pale"
    >
      <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-pale">
        <Plus className="size-[15px]" strokeWidth={2.4} />
      </span>
      {label}
    </Link>
  );
}
