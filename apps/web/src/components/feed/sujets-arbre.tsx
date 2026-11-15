"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import {
  AjouterDansSheet,
  type DestinationAjout,
} from "@/components/feed/ajouter-dans-sheet";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import {
  FileTextTrait,
  Folder,
  FolderDashedTrait,
  FolderTrait,
} from "@/components/shared/picto";
import type { SubjectRowData } from "@/components/shared/subject-row";
import { useIdsRetenus } from "@/hooks/use-ids-retenus";
import { FOLDER_COLORS, folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { FolderChip } from "@/server/cached";

// La VUE DOSSIERS de la page Sujets (M28.1, tranchée sur maquette — `ecarts`,
// « Sujets : une page, deux vues ») : l'arbre complet, dossiers ET sujets
// ensemble. Une carte par dossier de premier niveau ; « Sans dossier » en tête
// quand il n'est pas vide. Chaque ligne de dossier porte DEUX gestes, séparés :
// le NOM entre dans le dossier, la FLÈCHE, à droite et toujours dans la même
// colonne, plie ou déplie. Un sujet s'ouvre d'un tap.
//
// Ce que la ligne dit, et ce qu'elle tait :
//  - la pastille violette d'un DOSSIER compte ses sujets qui ONT BOUGÉ, les
//    siens et ceux de ses dossiers — jamais un total ;
//  - un SUJET qui a bougé a son titre en gras, rien de plus : pas de pastille
//    (le violet chiffré est aux dossiers), et pas de non-lus — un message ne
//    fait pas bouger un sujet, ses tâches si (domaine, `aBouge`) ;
//  - « Urgent · » est en gras, jamais en rouge : la couleur est aux dossiers.
//
// La DERNIÈRE LIGNE de chaque branche dépliée est « Ajouter dans <dossier> »,
// à tous les niveaux (M28.2) : elle ouvre la feuille de création, déjà posée
// sur ce dossier. En VIOLET, comme toute invite de l'application : ce qui se
// touche est violet (retour du dirigeant à l'essai). Ce qui a bougé ne s'y
// confond pas — c'est une pastille pleine et chiffrée, pas un mot. Un dossier vide se
// déplie donc quand même : il contient sa ligne d'ajout. Elle n'existe que
// sous les ouverts : on n'ajoute rien à ce qui est terminé.
//
// L'arbre arrive REPLIÉ et retient sur l'appareil ce qu'on a déplié : sur un
// compte réel, un arbre entièrement ouvert est une page sans fin, et la
// pastille suffit à dire où aller.

const CLE_DEPLIES = "relvo:sujets:deplies";
/** L'événement que le « + » du ciel envoie à l'arbre : ajouter au premier niveau. */
export const EVENEMENT_AJOUT = "relvo:sujets:ajouter";
/** L'identifiant de la carte « Sans dossier » dans l'état déplié. */
const AUCUN = "aucun";

type Noeud = {
  folder: FolderChip;
  enfants: Noeud[];
  sujets: SubjectRowData[];
  /** Les sujets de l'onglet dans le dossier ET dessous. */
  total: number;
  /** Ceux d'entre eux qui ont bougé. */
  bouges: number;
};

function construire(folders: FolderChip[], rows: SubjectRowData[]) {
  const noeuds = new Map<string, Noeud>(
    folders.map((folder) => [
      folder.id,
      { folder, enfants: [], sujets: [], total: 0, bouges: 0 },
    ]),
  );
  const tetes: Noeud[] = [];
  for (const n of noeuds.values()) {
    const pere = n.folder.parentId ? noeuds.get(n.folder.parentId) : null;
    // Le père d'un premier niveau est Général, absent de la liste.
    if (pere) pere.enfants.push(n);
    else tetes.push(n);
  }
  const sansDossier: SubjectRowData[] = [];
  for (const row of rows) {
    const id = row.folderChainIds?.at(-1);
    const n = id ? noeuds.get(id) : null;
    if (n) n.sujets.push(row);
    else sansDossier.push(row);
  }
  const compter = (n: Noeud) => {
    n.total = n.sujets.length;
    n.bouges = n.sujets.filter((s) => s.moved).length;
    for (const e of n.enfants) {
      compter(e);
      n.total += e.total;
      n.bouges += e.bouges;
    }
  };
  tetes.forEach(compter);
  return { tetes, sansDossier };
}

function Pastille({ n, label }: { n: number; label: string }) {
  return (
    <span
      aria-label={label}
      className="chiffre grid h-6 min-w-6 flex-none place-items-center rounded-full bg-relvo px-[7px] text-[14px] text-white"
    >
      {n}
    </span>
  );
}

/** La flèche de pli, à droite : une zone de frappe de 44 px autour d'un rond de 26. */
function Fleche({
  nom,
  ouvert,
  onBascule,
  surFond,
}: {
  nom: string;
  ouvert: boolean;
  onBascule: () => void;
  /** Sur la tête de carte (fond enfoncé), le rond est blanc. */
  surFond?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onBascule}
      aria-expanded={ouvert}
      aria-label={ouvert ? `Replier ${nom}` : `Déplier ${nom}`}
      className="mr-[5px] grid w-11 flex-none place-items-center self-stretch"
    >
      <span
        className={cn(
          "grid size-[26px] place-items-center rounded-full text-gris",
          surFond ? "border border-(--filet) bg-white" : "bg-(--fond-puce)",
        )}
      >
        <ChevronRight
          className={cn(
            "size-[15px] transition-transform",
            ouvert && "rotate-90",
          )}
          strokeWidth={2.4}
        />
      </span>
    </button>
  );
}

/** La colonne de la flèche, vide : un dossier sans rien dessous garde l'alignement. */
function SansFleche() {
  return <span aria-hidden className="w-[49px] flex-none" />;
}

/** Un trait de branche par niveau, à la couleur du dossier de premier niveau. */
function Traits({ niveau, color }: { niveau: number; color: string }) {
  return (
    <>
      {Array.from({ length: niveau + 1 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 opacity-30"
          style={{ left: 27 + 24 * i, background: color }}
        />
      ))}
    </>
  );
}

const retrait = (niveau: number) => 42 + 24 * niveau;

function LigneSujet({
  row,
  niveau,
  color,
  termine,
}: {
  row: SubjectRowData;
  niveau: number;
  color: string;
  /** Onglet validés ou fermés : la ligne ne dit plus rien de ce qui reste à faire. */
  termine: boolean;
}) {
  const mot = termine
    ? null
    : row.resolutionSuggested
      ? { relvo: true, label: "à valider" }
      : row.isNew
        ? { relvo: true, label: "nouveau" }
        : row.waitingForReply
          ? { relvo: false, label: "attend" }
          : null;
  return (
    <Link
      data-list-row
      href={`/sujets/${row.id}`}
      className="relative flex min-h-12 items-center gap-[9px] border-b border-(--filet) pr-3.5 active:bg-(--fond-enfonce)"
      style={{ paddingLeft: retrait(niveau) }}
    >
      <Traits niveau={niveau} color={color} />
      <FileTextTrait
        aria-hidden
        className="size-[19px] flex-none"
        style={{ color }}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[15.5px] leading-5 text-noir",
          row.moved && !termine ? "font-semibold" : "font-normal",
          termine && "text-gris",
        )}
      >
        {row.urgent && !termine ? (
          <span className="font-bold">Urgent · </span>
        ) : null}
        {row.title}
      </span>
      {mot ? (
        <span
          className={cn(
            "inline-flex flex-none items-center gap-1 text-[12.5px] leading-4",
            mot.relvo ? "font-medium text-relvo" : "font-normal text-gris",
          )}
        >
          {mot.relvo ? (
            <svg
              viewBox="116 104 296 296"
              width="10"
              height="10"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d={RELVO_LOGO_PATHS.stars[0]} />
            </svg>
          ) : null}
          {mot.label}
        </span>
      ) : null}
      {!termine && row.taskTotal > 0 ? (
        <span
          aria-label={`${row.taskDone} tâches faites sur ${row.taskTotal}`}
          className="chiffre min-w-6 flex-none text-center text-[17px] leading-5 text-noir"
        >
          {row.taskDone}/{row.taskTotal}
        </span>
      ) : null}
    </Link>
  );
}

function LigneAjout({
  label,
  niveau,
  color,
  onClick,
}: {
  label: string;
  niveau: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-list-row
      onClick={onClick}
      className="relative flex min-h-[46px] w-full items-center gap-[9px] border-b border-(--filet) pr-3.5 text-left active:bg-relvo-pale"
      style={{ paddingLeft: retrait(niveau) }}
    >
      <Traits niveau={niveau} color={color} />
      <span
        aria-hidden
        className="-mx-[2.5px] grid size-6 flex-none place-items-center rounded-full bg-relvo-pale text-relvo"
      >
        <Plus className="size-[15px]" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] leading-5 font-medium text-relvo">
        {label}
      </span>
    </button>
  );
}

export function SujetsArbre({
  folders,
  rows,
  ouverts,
  profondeurMax,
}: {
  /** Les dossiers, Général exclu, en ordre d'arbre. */
  folders: FolderChip[];
  /** Les sujets de l'onglet courant. */
  rows: SubjectRowData[];
  /** L'onglet des ouverts : tous les dossiers se montrent, et ce qui a bougé se compte. */
  ouverts: boolean;
  /** La profondeur bornée de l'arbre (domaine) : au-delà, un dossier n'en reçoit plus. */
  profondeurMax: number;
}) {
  const { tetes, sansDossier } = useMemo(
    () => construire(folders, rows),
    [folders, rows],
  );
  const { ids: deplies, bascule, remplace } = useIdsRetenus(CLE_DEPLIES);
  const [ajout, setAjout] = useState<DestinationAjout | null>(null);

  // Un nouveau premier niveau reçoit la première teinte de la palette que
  // ses voisins ne portent pas encore — il se recolore au crayon de sa fiche.
  const prises = new Set(tetes.map((n) => n.folder.color));
  const couleurLibre =
    FOLDER_COLORS.find((c) => !prises.has(c.key))?.key ??
    FOLDER_COLORS[tetes.length % FOLDER_COLORS.length].key;
  const aLaRacine = () => setAjout({ type: "racine", couleur: couleurLibre });

  // Le « + » du ciel vit dans l'en-tête de la page : il parle à l'arbre par
  // un événement, sans état partagé à remonter.
  useEffect(() => {
    const ecoute = () => setAjout({ type: "racine", couleur: couleurLibre });
    window.addEventListener(EVENEMENT_AJOUT, ecoute);
    return () => window.removeEventListener(EVENEMENT_AJOUT, ecoute);
  }, [couleurLibre]);

  const parId = new Map(folders.map((f) => [f.id, f]));
  /** Ce qu'il faut déplier pour voir ce qu'on vient de créer. */
  function deplierVers(dest: DestinationAjout) {
    if (dest.type === "racine") return;
    const ids = new Set(deplies);
    if (dest.type === "aucun") ids.add(AUCUN);
    else {
      let f = parId.get(dest.id);
      while (f) {
        ids.add(f.id);
        f = f.parentId ? parId.get(f.parentId) : undefined;
      }
    }
    remplace(ids);
  }
  const dans = (f: FolderChip): DestinationAjout => ({
    type: "dossier",
    id: f.id,
    chemin: f.path,
    dossierPossible: f.depth < profondeurMax,
  });

  // Sous validés et fermés, un dossier qui n'en contient aucun ne se montre pas.
  const montre = (n: Noeud) => ouverts || n.total > 0;
  // Sous les ouverts, tout dossier se déplie : il contient au moins sa ligne d'ajout.
  const aDessous = (n: Noeud) =>
    ouverts || n.enfants.some(montre) || n.sujets.length > 0;

  const pliables: string[] = [];
  const recenser = (n: Noeud) => {
    if (!montre(n)) return;
    if (aDessous(n)) pliables.push(n.folder.id);
    n.enfants.forEach(recenser);
  };
  tetes.forEach(recenser);
  const montreAucun = sansDossier.length > 0;
  if (montreAucun) pliables.push(AUCUN);
  const unOuvert = pliables.some((id) => deplies.has(id));

  function branche(n: Noeud, niveau: number, color: string): React.ReactNode[] {
    const lignes: React.ReactNode[] = [];
    for (const e of n.enfants.filter(montre)) {
      const ouvert = deplies.has(e.folder.id);
      lignes.push(
        <div
          key={e.folder.id}
          data-list-row
          className="relative flex min-h-[50px] items-center border-b border-(--filet)"
          style={{ paddingLeft: retrait(niveau) }}
        >
          <Traits niveau={niveau} color={color} />
          <Link
            href={`/memoire/${e.folder.id}`}
            aria-label={`Ouvrir le dossier ${e.folder.name}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-1.5 active:bg-(--fond-enfonce)"
          >
            <FolderTrait
              aria-hidden
              className="size-5 flex-none"
              style={{ color }}
            />
            <span className="min-w-0 flex-1 truncate text-[15.5px] leading-5 font-semibold text-noir">
              {e.folder.name}
            </span>
            {ouverts && e.bouges > 0 ? (
              <Pastille
                n={e.bouges}
                label={`${e.bouges} sujet${e.bouges > 1 ? "s ont" : " a"} bougé`}
              />
            ) : null}
          </Link>
          {aDessous(e) ? (
            <Fleche
              nom={e.folder.name}
              ouvert={ouvert}
              onBascule={() => bascule(e.folder.id)}
            />
          ) : (
            <SansFleche />
          )}
        </div>,
      );
      if (ouvert) lignes.push(...branche(e, niveau + 1, color));
    }
    for (const row of n.sujets) {
      lignes.push(
        <LigneSujet
          key={row.id}
          row={row}
          niveau={niveau}
          color={color}
          termine={!ouverts}
        />,
      );
    }
    if (ouverts) {
      lignes.push(
        <LigneAjout
          key={`ajout-${n.folder.id}`}
          label={`Ajouter dans ${n.folder.name}`}
          niveau={niveau}
          color={color}
          onClick={() => setAjout(dans(n.folder))}
        />,
      );
    }
    return lignes;
  }

  return (
    <div className="flex flex-col gap-3">
      {pliables.length > 0 ? (
        <div className="-my-2 flex justify-end px-[22px]">
          <button
            type="button"
            onClick={() => remplace(unOuvert ? [] : pliables)}
            className="min-h-11 px-0.5 text-[13.5px] font-medium text-relvo"
          >
            {unOuvert ? "Tout replier" : "Tout déplier"}
          </button>
        </div>
      ) : null}

      {montreAucun ? (
        <ListPanel>
          <div
            data-list-row
            className="flex min-h-[58px] items-center border-b border-(--filet) bg-(--fond-enfonce)"
          >
            <button
              type="button"
              onClick={() => bascule(AUCUN)}
              aria-expanded={deplies.has(AUCUN)}
              className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-1.5 pl-4 text-left"
            >
              <FolderDashedTrait
                aria-hidden
                className="size-6 flex-none text-gris"
              />
              <span className="min-w-0 flex-1 truncate font-heading text-[21px] leading-6 font-semibold text-noir">
                Sans dossier
              </span>
              {ouverts && sansDossier.some((s) => s.moved) ? (
                <Pastille
                  n={sansDossier.filter((s) => s.moved).length}
                  label="Sujets qui ont bougé"
                />
              ) : null}
            </button>
            <Fleche
              nom="Sans dossier"
              ouvert={deplies.has(AUCUN)}
              onBascule={() => bascule(AUCUN)}
              surFond
            />
          </div>
          {deplies.has(AUCUN)
            ? sansDossier.map((row) => (
                <LigneSujet
                  key={row.id}
                  row={row}
                  niveau={0}
                  color="var(--gris-clair)"
                  termine={!ouverts}
                />
              ))
            : null}
          {deplies.has(AUCUN) && ouverts ? (
            <LigneAjout
              label="Ajouter un sujet sans dossier"
              niveau={0}
              color="var(--gris-clair)"
              onClick={() => setAjout({ type: "aucun" })}
            />
          ) : null}
        </ListPanel>
      ) : null}

      {tetes.filter(montre).map((n) => {
        const { color } = folderVisual({
          slug: n.folder.slug,
          color: n.folder.color,
          icon: n.folder.icon,
        });
        const ouvert = deplies.has(n.folder.id);
        return (
          <ListPanel key={n.folder.id}>
            <div
              data-list-row
              className="flex min-h-[58px] items-center border-b border-(--filet) bg-(--fond-enfonce)"
            >
              <Link
                href={`/memoire/${n.folder.id}`}
                aria-label={`Ouvrir le dossier ${n.folder.name}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-1.5 pl-4 active:bg-(--fond-puce)"
              >
                <Folder
                  aria-hidden
                  className="size-6 flex-none"
                  style={{ color }}
                />
                <span className="min-w-0 flex-1 truncate font-heading text-[21px] leading-6 font-semibold text-noir">
                  {n.folder.name}
                </span>
                {ouverts && n.bouges > 0 ? (
                  <Pastille
                    n={n.bouges}
                    label={`${n.bouges} sujet${n.bouges > 1 ? "s ont" : " a"} bougé`}
                  />
                ) : null}
              </Link>
              {aDessous(n) ? (
                <Fleche
                  nom={n.folder.name}
                  ouvert={ouvert}
                  onBascule={() => bascule(n.folder.id)}
                  surFond
                />
              ) : (
                <SansFleche />
              )}
            </div>
            {ouvert ? branche(n, 0, color) : null}
          </ListPanel>
        );
      })}

      <button
        type="button"
        onClick={aLaRacine}
        className="mx-4 flex min-h-[52px] items-center justify-center gap-2.5 rounded-(--rayon-carte) border-[1.5px] border-dashed border-(--relvo-filet) bg-white text-[15px] font-medium text-relvo active:bg-relvo-pale"
      >
        <Plus className="size-[15px]" strokeWidth={2.4} />
        Nouveau dossier
      </button>

      <AjouterDansSheet
        destination={ajout}
        onOpenChange={(o) => !o && setAjout(null)}
        onCree={() => ajout && deplierVers(ajout)}
      />
    </div>
  );
}
