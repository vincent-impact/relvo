"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AddFolderRow } from "@/components/memoire/folder-row";
import { useIdsRetenus } from "@/hooks/use-ids-retenus";
import { ListPanel } from "@/components/shared/list-panel";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { CachedFolderRow } from "@/server/cached";

// L'ARBRE des dossiers d'un dossier (M27.2, M27.3) — l'onglet Dossiers d'une
// fiche : UNE carte, tout l'arbre sous ce dossier. Chaque ligne porte DEUX
// gestes, séparés : le TRIANGLE à gauche déplie ou replie la branche (une zone
// de frappe de 44 px autour d'un rond de 26), LA LIGNE entre dans le dossier —
// le chevron à droite le dit. Une branche sans dossier n'a pas de triangle.
// L'état replié se retient sur l'appareil : l'arbre arrive déplié, le
// dirigeant replie ce qui l'encombre, et le retrouve ainsi. La vue d'ensemble
// — tous les dossiers ET leurs sujets — est la vue Dossiers de la page Sujets
// (`feed/sujets-arbre.tsx`, M28).
//
// Le compte au bout d'une ligne est celui des sujets ouverts du dossier, ses
// dossiers compris (la portée, M23.4) ; un zéro ne s'écrit pas.

const CLE_REPLIES = "relvo:dossiers:replies";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** La sous-ligne d'une branche de premier niveau : ce qu'elle porte, hors sujets (leur compte est à droite). */
function sousLigne(f: CachedFolderRow): string {
  const parts: string[] = [];
  if (f.children > 0) parts.push(plural(f.children, "dossier"));
  if (f.instructions > 0) parts.push(plural(f.instructions, "instruction"));
  if (f.documents > 0) parts.push(plural(f.documents, "connaissance"));
  return parts.join(" · ");
}

const INDENT = 22;

function Branche({
  folder: f,
  niveau,
  replie,
  onBascule,
}: {
  folder: CachedFolderRow;
  /** Le niveau DANS l'arbre montré : 1 pour une branche de tête, même sous un dossier. */
  niveau: number;
  replie: boolean;
  onBascule: () => void;
}) {
  const { color } = folderVisual({
    slug: f.slug,
    color: f.color,
    icon: f.icon,
  });
  const premier = niveau === 1;
  const retrait = 14 + INDENT * (niveau - 1);
  const sous = premier ? sousLigne(f) : "";
  return (
    <div
      data-list-row
      className={cn(
        "relative flex items-center gap-2.5 border-b border-(--filet) pr-3.5",
        premier ? "min-h-[52px] py-1.5" : "min-h-[44px]",
      )}
      style={{ paddingLeft: retrait }}
    >
      {/* Le trait qui relie un dossier à ses fils : la couleur du premier
          niveau, à peine posée, de haut en bas de la branche. */}
      {niveau > 1 ? (
        <span
          aria-hidden
          className="absolute top-0 bottom-0 w-0.5 opacity-30"
          style={{ left: retrait - 11, background: color }}
        />
      ) : null}
      {f.children > 0 ? (
        <button
          type="button"
          onClick={onBascule}
          aria-expanded={!replie}
          aria-label={replie ? `Déplier ${f.name}` : `Replier ${f.name}`}
          className="relative z-10 grid size-[26px] flex-none place-items-center rounded-full bg-(--fond-puce) text-gris before:absolute before:-inset-[9px] before:content-[''] active:bg-(--relvo-filet)"
        >
          {replie ? (
            <ChevronRight className="size-4" strokeWidth={2} />
          ) : (
            <ChevronDown className="size-4" strokeWidth={2} />
          )}
        </button>
      ) : (
        <span aria-hidden className="size-[26px] flex-none" />
      )}
      <span
        aria-hidden
        className={cn("bande-ligne", !premier && "h-7 w-1 rounded-[2px]")}
        style={{ background: color }}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/memoire/${f.id}`}
          className="block truncate text-[14.5px] leading-[18px] font-normal text-noir after:absolute after:inset-0 after:content-['']"
        >
          {f.name}
        </Link>
        {sous ? (
          <p className="truncate text-[12px] leading-[14px] font-normal text-gris">
            {sous}
          </p>
        ) : null}
      </div>
      {f.openSubjects > 0 ? (
        <span className="chiffre flex-none text-[16px] leading-[18px] text-noir">
          {f.openSubjects}
        </span>
      ) : null}
      <ChevronRight
        className="size-4 flex-none text-(--gris-clair)"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
}

/** Les branches repliées sur cet appareil, et le geste qui les bascule — partagés par la page Dossiers, l'onglet d'un dossier et la feuille « Ranger dans… ». */
export function useRepliesDossiers() {
  const { ids: replies, bascule } = useIdsRetenus(CLE_REPLIES);
  return { replies, bascule };
}

export function FolderTree({
  folders,
  ajout,
  className,
}: {
  /** Les dossiers à montrer, en ordre d'arbre (profondeur d'abord) ; le niveau se lit du plus haut d'entre eux. */
  folders: CachedFolderRow[];
  /** L'invite d'ajout : en pied (la page Dossiers) ou en tête (l'onglet d'un dossier, M27.3) ; absente quand l'arbre ne peut plus descendre. */
  ajout?: {
    label: string;
    parentId: string | null;
    position: "haut" | "bas";
  } | null;
  className?: string;
}) {
  // Le niveau de tête : 1 sous Général, mais aussi 1 pour les fils d'un
  // dossier montrés dans son onglet — l'arbre se lit pareil partout.
  const base = folders.length
    ? Math.min(...folders.map((f) => f.depth)) - 1
    : 0;
  const { replies, bascule } = useRepliesDossiers();

  // Une branche se montre si aucun de ses pères n'est replié.
  const parDossier = new Map(folders.map((f) => [f.id, f]));
  const visible = (f: CachedFolderRow): boolean => {
    let p = f.parentId;
    while (p) {
      if (replies.has(p)) return false;
      p = parDossier.get(p)?.parentId ?? null;
    }
    return true;
  };

  return (
    <ListPanel className={className}>
      {ajout?.position === "haut" ? (
        <AddFolderRow parentId={ajout.parentId} label={ajout.label} />
      ) : null}
      {folders.filter(visible).map((f) => (
        <Branche
          key={f.id}
          folder={f}
          niveau={f.depth - base}
          replie={replies.has(f.id)}
          onBascule={() => bascule(f.id)}
        />
      ))}
      {ajout?.position === "bas" ? (
        <AddFolderRow parentId={ajout.parentId} label={ajout.label} />
      ) : null}
    </ListPanel>
  );
}
