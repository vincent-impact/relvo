"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useRepliesDossiers } from "@/components/memoire/folder-tree";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// La feuille « Ranger dans… » (M27.4, tranchée sur maquettes) — ce qui s'ouvre
// quand on range un sujet (la ligne glissée à droite dans un dossier, le
// dossier dans le ciel de sa fiche) ou quand on déplace un dossier (le crayon,
// « Rangé dans »). Elle monte du bas, à mi-hauteur, et montre LE MÊME ARBRE
// que la page Dossiers, avec les mêmes triangles et le même état replié : on
// n'apprend pas un second arbre. Le dossier actuel est cerclé ; Général est
// grisé quand il s'agit d'un sujet (la racine n'en range aucun, invariant 17)
// et se choisit quand il s'agit d'un dossier ; « Sans dossier » reste possible
// pour un sujet. Un tap choisit et ferme ; la feuille se glisse vers le bas ou
// se tape hors d'elle pour abandonner. Pas de glisser-déposer : rien que
// cette feuille ne fasse en deux taps, y compris entre deux dossiers de
// premier niveau.

export type DossierChoix = {
  id: string;
  name: string;
  path: string;
  /** Les clés de logo du premier niveau : la bande. */
  slug: string | null;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  depth: number;
  /** Les sujets ouverts du dossier, ses fils compris — absent quand on ne les compte pas. */
  openSubjects?: number;
};

const INDENT = 22;

export function RangerDansSheet({
  open,
  onOpenChange,
  titre = "Ranger dans…",
  sousTitre,
  dossiers,
  actuel,
  racine,
  sansDossier = false,
  exclus,
  onChoix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre?: string;
  /** Ce qu'on range, et où il est aujourd'hui. */
  sousTitre?: string;
  /** L'arbre, Général exclu, en ordre d'arbre (profondeur d'abord). */
  dossiers: DossierChoix[];
  /** Le dossier actuel (cerclé) ; `null` = sans dossier ou à la racine. */
  actuel: string | null;
  /** Général : grisé (un sujet) ou choisissable (un dossier, « à la racine »). */
  racine: "grisee" | "choisissable";
  /** Proposer « Sans dossier » (un sujet). */
  sansDossier?: boolean;
  /** Les dossiers qu'on ne peut pas choisir (lui-même, ses fils, trop profond) : montrés grisés. */
  exclus?: ReadonlySet<string>;
  onChoix: (id: string | null) => void;
}) {
  const { replies, bascule } = useRepliesDossiers();
  const parDossier = new Map(dossiers.map((d) => [d.id, d]));
  const avecFils = new Set(
    dossiers.map((d) => d.parentId).filter((p): p is string => p != null),
  );
  const visible = (d: DossierChoix): boolean => {
    let p = d.parentId;
    while (p) {
      if (replies.has(p)) return false;
      p = parDossier.get(p)?.parentId ?? null;
    }
    return true;
  };

  function choisir(id: string | null) {
    onOpenChange(false);
    onChoix(id);
  }

  const ligneGenerale = (
    <div
      className={cn(
        "relative flex min-h-[56px] items-center gap-2.5 border-b border-(--filet) bg-(--fond-enfonce) px-3.5 py-2",
        racine === "grisee" && "opacity-50",
      )}
    >
      {racine === "choisissable" ? (
        <>
          <button
            type="button"
            onClick={() => choisir(null)}
            className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
          >
            <span className="flex items-center font-heading text-[18px] leading-[22px] font-semibold text-noir">
              <span className="truncate">Général</span>
              {actuel == null ? <Ici /> : null}
            </span>
            <span className="block truncate text-[12px] leading-[14px] font-normal text-gris">
              La racine — à côté des dossiers de premier niveau
            </span>
          </button>
          {actuel == null ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1.5 inset-y-[3px] rounded-(--rayon-option) border-2 border-relvo"
            />
          ) : null}
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-[18px] leading-[22px] font-semibold text-noir">
            Général
          </div>
          <p className="text-[12px] leading-[14px] font-normal text-gris">
            La racine ne range pas de sujet : seulement vos instructions et
            connaissances
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="shadow-feuille max-h-[85dvh] rounded-t-(--rayon-feuille) border-t-0 bg-white p-0"
      >
        {/* La poignée : la feuille se glisse vers le bas. */}
        <span
          aria-hidden
          className="mx-auto mt-2 mb-2 block h-1 w-9 rounded-full bg-(--gris-clair)"
        />
        <div className="border-b border-(--filet) px-4 pb-2.5">
          <SheetTitle className="font-heading text-[22px] leading-[26px] font-semibold text-noir">
            {titre}
          </SheetTitle>
          {sousTitre ? (
            <SheetDescription className="mt-0.5 text-[12px] leading-4 font-normal text-gris">
              {sousTitre}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              Choisissez un dossier
            </SheetDescription>
          )}
        </div>
        <div className="overflow-y-auto pb-[max(env(safe-area-inset-bottom),12px)]">
          {ligneGenerale}
          {dossiers.filter(visible).map((d) => {
            const { color } = folderVisual({
              slug: d.slug,
              color: d.color,
              icon: d.icon,
            });
            const niveau = d.depth;
            const premier = niveau === 1;
            const retrait = 14 + INDENT * (niveau - 1);
            const exclu = exclus?.has(d.id) ?? false;
            const ici = d.id === actuel;
            const replie = replies.has(d.id);
            return (
              <div
                key={d.id}
                className={cn(
                  "relative flex items-center gap-2.5 border-b border-(--filet) pr-3.5",
                  premier ? "min-h-[52px] py-1.5" : "min-h-[44px]",
                  exclu && "opacity-45",
                )}
                style={{ paddingLeft: retrait }}
              >
                {niveau > 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-0 bottom-0 w-0.5 opacity-30"
                    style={{ left: retrait - 11, background: color }}
                  />
                ) : null}
                {avecFils.has(d.id) ? (
                  <button
                    type="button"
                    onClick={() => bascule(d.id)}
                    aria-expanded={!replie}
                    aria-label={
                      replie ? `Déplier ${d.name}` : `Replier ${d.name}`
                    }
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
                  className={cn(
                    "bande-ligne",
                    !premier && "h-7 w-1 rounded-[2px]",
                  )}
                  style={{ background: color }}
                />
                <button
                  type="button"
                  disabled={exclu}
                  onClick={() => choisir(d.id)}
                  className="flex min-w-0 flex-1 items-center text-left text-[14.5px] leading-[18px] font-normal text-noir after:absolute after:inset-0 after:content-[''] disabled:after:content-none"
                >
                  <span className="truncate">{d.name}</span>
                  {ici ? <Ici /> : null}
                </button>
                {d.openSubjects ? (
                  <span className="chiffre flex-none text-[16px] leading-[18px] text-noir">
                    {d.openSubjects}
                  </span>
                ) : null}
                {/* Le cerclage de l'actuel : la sélection est un cerclage, jamais un remplissage. */}
                {ici ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-1.5 inset-y-[3px] rounded-(--rayon-option) border-2 border-relvo"
                  />
                ) : null}
              </div>
            );
          })}
          {sansDossier ? (
            <div className="relative flex min-h-[52px] items-center gap-2.5 py-1.5 pr-3.5 pl-[50px]">
              <span
                aria-hidden
                className="h-[34px] w-1.5 flex-none rounded-[3px] border-2 border-dashed border-(--gris-clair)"
              />
              <button
                type="button"
                onClick={() => choisir(null)}
                className="min-w-0 flex-1 truncate text-left text-[14.5px] leading-[18px] font-normal text-noir after:absolute after:inset-0 after:content-['']"
              >
                Sans dossier
                {actuel == null ? <Ici /> : null}
              </button>
              {actuel == null ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1.5 inset-y-[3px] rounded-(--rayon-option) border-2 border-relvo"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Ici() {
  return (
    <span className="ml-1.5 inline-block rounded-(--rayon-pilule) bg-(--fond-puce) px-1.5 py-px align-[1px] text-[11px] font-medium tracking-[0.06em] text-gris uppercase">
      ici
    </span>
  );
}
