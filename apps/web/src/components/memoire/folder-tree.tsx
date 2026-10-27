"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AddFolderRow } from "@/components/memoire/folder-row";
import { ListPanel } from "@/components/shared/list-panel";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { CachedFolderRow } from "@/server/cached";

// L'ARBRE des dossiers (M27.2) — la page Dossiers, telle que le dirigeant l'a
// retenue sur maquettes (`ecarts`, « Un sujet se range dans un dossier ») :
// UNE carte, tout l'arbre, Général en tête de carte (« la racine — tout est
// dedans »). Chaque ligne porte DEUX gestes, séparés : le TRIANGLE à gauche
// déplie ou replie la branche (une zone de frappe de 44 px autour d'un rond de
// 26), LA LIGNE entre dans le dossier — le chevron à droite le dit. Une
// branche sans dossier n'a pas de triangle. L'état replié se retient sur
// l'appareil (localStorage) : l'arbre arrive déplié, le dirigeant replie ce
// qui l'encombre, et le retrouve ainsi.
//
// Le compte au bout d'une ligne est celui des sujets ouverts du dossier, ses
// dossiers compris (la portée, M23.4) ; un zéro ne s'écrit pas. « Sans
// dossier », au pied, en bande pointillée (« à compléter »), mène à la page
// Sujets filtrée sur ce que Relvo n'a pas su ranger — seulement s'il y en a.

const CLE_REPLIES = "relvo:dossiers:replies";
const RIEN = "[]";

// L'état replié est un magasin EXTERNE (le stockage de l'appareil), lu par
// `useSyncExternalStore` : le serveur et la première peinture disent « tout
// déplié », puis l'appareil impose ses plis, sans écart d'hydratation ni
// `setState` dans un effet.
const ecouteurs = new Set<() => void>();
function abonner(cb: () => void) {
  ecouteurs.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ecouteurs.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function instantane(): string {
  try {
    return window.localStorage.getItem(CLE_REPLIES) ?? RIEN;
  } catch {
    return RIEN;
  }
}
function analyser(brut: string): Set<string> {
  try {
    const ids = JSON.parse(brut) as unknown;
    return new Set(
      Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}
function ecrireReplies(ids: Set<string>) {
  try {
    window.localStorage.setItem(CLE_REPLIES, JSON.stringify([...ids]));
  } catch {
    // Navigation privée, stockage plein : l'arbre reste déplié, rien de grave.
  }
  ecouteurs.forEach((cb) => cb());
}

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
  replie,
  onBascule,
}: {
  folder: CachedFolderRow;
  replie: boolean;
  onBascule: () => void;
}) {
  const { color } = folderVisual({
    slug: f.slug,
    color: f.color,
    icon: f.icon,
  });
  const premier = f.depth === 1;
  const retrait = 14 + INDENT * (f.depth - 1);
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
      {f.depth > 1 ? (
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

export function FolderTree({
  general,
  folders,
  unfiled,
  className,
}: {
  /** La racine : ses instructions et connaissances valent pour tous. */
  general: CachedFolderRow | null;
  /** Les dossiers, Général exclu, en ordre d'arbre (profondeur d'abord). */
  folders: CachedFolderRow[];
  /** Les sujets ouverts que Relvo n'a pas su ranger. */
  unfiled: number;
  className?: string;
}) {
  const brut = useSyncExternalStore(abonner, instantane, () => RIEN);
  const replies = useMemo(() => analyser(brut), [brut]);

  function bascule(id: string) {
    const apres = new Set(replies);
    if (apres.has(id)) apres.delete(id);
    else apres.add(id);
    ecrireReplies(apres);
  }

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
      {general ? (
        <Link
          data-list-row
          href={`/memoire/${general.id}`}
          className="flex min-h-[56px] items-center gap-2.5 border-b border-(--filet) bg-(--fond-enfonce) px-3.5 py-2 active:bg-(--fond-puce)"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-[18px] leading-[22px] font-semibold text-noir">
              {general.name}
            </div>
            <p className="truncate text-[12px] leading-[14px] font-normal text-gris">
              {[
                "La racine — tout est dedans",
                general.instructions > 0
                  ? plural(general.instructions, "instruction")
                  : null,
                general.documents > 0
                  ? plural(general.documents, "connaissance")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ChevronRight
            className="size-4 flex-none text-(--gris-clair)"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      ) : null}
      {folders.filter(visible).map((f) => (
        <Branche
          key={f.id}
          folder={f}
          replie={replies.has(f.id)}
          onBascule={() => bascule(f.id)}
        />
      ))}
      {unfiled > 0 ? (
        <Link
          data-list-row
          href="/fil?dossier=aucun"
          className="flex min-h-[52px] items-center gap-2.5 border-b border-(--filet) py-1.5 pr-3.5 pl-[50px] active:bg-(--fond-enfonce)"
        >
          <span
            aria-hidden
            className="h-[34px] w-1.5 flex-none rounded-[3px] border-2 border-dashed border-(--gris-clair)"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] leading-[18px] font-normal text-noir">
              Sans dossier
            </div>
            <p className="truncate text-[12px] leading-[14px] font-normal text-gris">
              Ce que Relvo n’a pas su ranger
            </p>
          </div>
          <span className="chiffre flex-none text-[16px] leading-[18px] text-noir">
            {unfiled}
          </span>
          <ChevronRight
            className="size-4 flex-none text-(--gris-clair)"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      ) : null}
      <AddFolderRow label="Ajouter un dossier dans Général" />
    </ListPanel>
  );
}
