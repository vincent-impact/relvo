"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AjouterDansSheet,
  type DestinationAjout,
} from "@/components/feed/ajouter-dans-sheet";
import { SwipeableDoneSubject } from "@/components/feed/swipeable-done-subject";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import { ECRAN_POUSSE } from "@/components/layout/ecran-transition";
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
import { type Cible, type Glisse, depotPermis } from "@/lib/arbre-depot";
import { FOLDER_COLORS, folderVisual } from "@/lib/folders";
import { vibrer } from "@/lib/haptique";
import { cn } from "@/lib/utils";
import { moveFolderAction } from "@/server/actions/folders";
import { updateSubjectAction } from "@/server/actions/subjects";
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
// Un sujet se BALAIE ici comme dans la liste à plat (retour du dirigeant à
// l'essai : l'avoir perdu dans l'arbre était dommageable) : à droite valider, à
// gauche fermer ; sous validés et fermés, remettre et supprimer. Le même geste
// dit la même chose dans les deux vues.
//
// La DERNIÈRE LIGNE de chaque branche dépliée est « Ajouter dans <dossier> »,
// à tous les niveaux (M28.2) : elle ouvre la feuille de création, déjà posée
// sur ce dossier. En VIOLET, comme toute invite de l'application : ce qui se
// touche est violet (retour du dirigeant à l'essai). Ce qui a bougé ne s'y
// confond pas — c'est une pastille pleine et chiffrée, pas un mot. Un dossier vide se
// déplie donc quand même : il contient sa ligne d'ajout. Elle n'existe que
// sous les ouverts : on n'ajoute rien à ce qui est terminé.
//
// GLISSER-DÉPOSER (M28.3) : un sujet ou un dossier se dépose dans un autre
// dossier. Au doigt, rien ne se passe avant un maintien d'un tiers de seconde
// — bouger avant annule et laisse défiler ; à la souris, tirer suffit. La
// cible permise est surlignée (`lib/arbre-depot.ts` dit ce qui l'est), un
// dossier replié survolé s'ouvre, la page défile près des bords, et un dossier
// lâché sur le bouton du pied remonte au premier niveau. Un toast annule. Ce
// geste n'est jamais le seul chemin : la feuille « Ranger dans… » reste, sur
// la fiche d'un sujet et au crayon d'un dossier. Ce qu'on tient NE BOUGE PAS à
// la prise : la miniature est la ligne elle-même, là où elle était, et le point
// touché reste le point d'accroche ; elle se SOULÈVE (`.souleve` : un peu plus
// grande, une ombre franche, cerclée de violet) pour dire que le maintien a
// pris. Elle est rendue hors de la zone qui défile
// (portail) : dedans, elle partait avec la page au premier défilement. Tant
// qu'on tient une ligne, son balayage est gelé — un seul geste parle à la fois.
//
// L'arbre arrive REPLIÉ et retient sur l'appareil ce qu'on a déplié : sur un
// compte réel, un arbre entièrement ouvert est une page sans fin, et la
// pastille suffit à dire où aller.

const CLE_DEPLIES = "relvo:sujets:deplies";
/** L'événement que le « + » du ciel envoie à l'arbre : ajouter au premier niveau. */
export const EVENEMENT_AJOUT = "relvo:sujets:ajouter";
/** L'identifiant de la carte « Sans dossier » dans l'état déplié. */
const AUCUN = "aucun";

const abonneARien = () => () => {};

/** Ce qu'une ligne tenue montre sous le doigt. */
type Prise = {
  glisse: Glisse;
  nom: string;
  color: string;
  /** Le retrait intérieur de ce qu'on a saisi : la miniature le reprend, rien ne saute. */
  retrait: number;
  /** Une tête de carte : son titre garde sa taille. */
  tete: boolean;
  /** La graisse du titre saisi : la miniature ne la change pas. */
  gras: boolean;
};

/** L'état du geste, lu par chaque ligne : ce qu'on tient, et la cible permise survolée. */
const Geste = createContext<{
  pris: Prise | null;
  sur: Cible | null;
  /** Vrai du début de la prise jusqu'après le lâcher : gèle le balayage des lignes. */
  gele: () => boolean;
}>({ pris: null, sur: null, gele: () => false });

// Une ligne qui se prend : pas de sélection de texte ni de menu d'aperçu au
// maintien (iOS en ouvre un sur tout lien), pas de glissé natif du lien à la
// souris.
const PRENABLE = "select-none [-webkit-touch-callout:none]";
const SURVOLEE = "bg-relvo-pale ring-2 ring-relvo ring-inset";

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
  cible,
  niveau,
  color,
  termine,
}: {
  row: SubjectRowData;
  /** Le dossier de la ligne : lâcher sur elle, c'est lâcher dans son dossier. */
  cible: Cible;
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
  const { pris, gele } = useContext(Geste);
  const { setNodeRef: prendre, listeners: poignee } = useDraggable({
    id: `sujet:${row.id}`,
    data: {
      glisse: {
        type: "sujet",
        id: row.id,
        dossier: cible === "aucun" ? null : cible,
      },
      nom: row.title,
      color,
      retrait: retrait(niveau),
      tete: false,
      gras: row.moved && !termine,
    } satisfies Prise,
  });
  const { setNodeRef: deposer } = useDroppable({
    id: `sur-sujet:${row.id}`,
    data: { cible },
  });
  const tenu = pris?.glisse.type === "sujet" && pris.glisse.id === row.id;
  const Balayage = termine ? SwipeableDoneSubject : SwipeableSubject;
  return (
    <Balayage
      subjectId={row.id}
      canClose
      openTasks={Math.max(row.taskTotal - row.taskDone, 0)}
      gele={gele}
    >
      <div
        ref={(el) => {
          prendre(el);
          deposer(el);
        }}
        {...poignee}
        data-list-row
        className={cn(
          "relative flex min-h-12 items-center gap-[9px] border-b border-(--filet) pr-3.5",
          PRENABLE,
          tenu && "opacity-35",
        )}
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
      </div>
    </Balayage>
  );
}

function LigneAjout({
  label,
  cible,
  niveau,
  color,
  onClick,
}: {
  label: string;
  cible: Cible;
  niveau: number;
  color: string;
  onClick: () => void;
}) {
  const { setNodeRef: deposer } = useDroppable({
    id: `sur-ajout:${cible}`,
    data: { cible },
  });
  return (
    <button
      ref={deposer}
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

/** La ligne d'un dossier, tête de carte ou sous-dossier : elle se prend par son nom, et reçoit ce qu'on lâche sur elle. */
function LigneDossier({
  folder,
  tete,
  niveau = 0,
  color,
  bouges,
  ouvert,
  pliable,
  onBascule,
}: {
  folder: FolderChip;
  /** Tête de carte : le dossier de premier niveau, plein, en titre. */
  tete: boolean;
  niveau?: number;
  color: string;
  /** Ses sujets qui ont bougé — rien quand on ne les compte pas. */
  bouges: number;
  ouvert: boolean;
  pliable: boolean;
  onBascule: () => void;
}) {
  const { pris, sur } = useContext(Geste);
  const { setNodeRef: prendre, listeners: poignee } = useDraggable({
    id: `dossier:${folder.id}`,
    data: {
      glisse: { type: "dossier", id: folder.id },
      nom: folder.name,
      color,
      retrait: tete ? 16 : 0,
      tete,
      gras: true,
    } satisfies Prise,
  });
  const { setNodeRef: deposer } = useDroppable({
    id: `sur-dossier:${folder.id}`,
    data: { cible: folder.id },
  });
  const tenu = pris?.glisse.type === "dossier" && pris.glisse.id === folder.id;
  const Icone = tete ? Folder : FolderTrait;
  return (
    <div
      ref={deposer}
      data-list-row
      className={cn(
        "relative flex items-center border-b border-(--filet)",
        tete ? "min-h-[58px] bg-(--fond-enfonce)" : "min-h-[50px]",
        sur === folder.id && SURVOLEE,
        tenu && "opacity-35",
      )}
      style={tete ? undefined : { paddingLeft: retrait(niveau) }}
    >
      {tete ? null : <Traits niveau={niveau} color={color} />}
      <Link
        ref={prendre}
        {...poignee}
        draggable={false}
        href={`/memoire/${folder.id}`}
        transitionTypes={[ECRAN_POUSSE]}
        aria-label={`Ouvrir le dossier ${folder.name}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-1.5",
          tete ? "pl-4 active:bg-(--fond-puce)" : "active:bg-(--fond-enfonce)",
          PRENABLE,
        )}
      >
        <Icone
          aria-hidden
          className={cn("flex-none", tete ? "size-6" : "size-5")}
          style={{ color }}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-semibold text-noir",
            tete
              ? "font-heading text-[21px] leading-6"
              : "text-[15.5px] leading-5",
          )}
        >
          {folder.name}
        </span>
        {bouges > 0 ? (
          <Pastille
            n={bouges}
            label={`${bouges} sujet${bouges > 1 ? "s ont" : " a"} bougé`}
          />
        ) : null}
      </Link>
      {pliable ? (
        <Fleche
          nom={folder.name}
          ouvert={ouvert}
          onBascule={onBascule}
          surFond={tete}
        />
      ) : (
        <SansFleche />
      )}
    </div>
  );
}

/** La tête de « Sans dossier » : un sujet lâché dessus sort de son dossier. */
function TeteAucun({
  bouges,
  ouvert,
  onBascule,
}: {
  bouges: number;
  ouvert: boolean;
  onBascule: () => void;
}) {
  const { sur } = useContext(Geste);
  const { setNodeRef: deposer } = useDroppable({
    id: "sur-aucun",
    data: { cible: AUCUN },
  });
  return (
    <div
      ref={deposer}
      data-list-row
      className={cn(
        "flex min-h-[58px] items-center border-b border-(--filet) bg-(--fond-enfonce)",
        sur === AUCUN && SURVOLEE,
      )}
    >
      <button
        type="button"
        onClick={onBascule}
        aria-expanded={ouvert}
        className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-1.5 pl-4 text-left"
      >
        <FolderDashedTrait aria-hidden className="size-6 flex-none text-gris" />
        <span className="min-w-0 flex-1 truncate font-heading text-[21px] leading-6 font-semibold text-noir">
          Sans dossier
        </span>
        {bouges > 0 ? (
          <Pastille n={bouges} label="Sujets qui ont bougé" />
        ) : null}
      </button>
      <Fleche
        nom="Sans dossier"
        ouvert={ouvert}
        onBascule={onBascule}
        surFond
      />
    </div>
  );
}

/** Le bouton du pied : « Nouveau dossier », et la cible du premier niveau pendant qu'on tient un dossier. */
function PiedRacine({
  accueille,
  onClick,
}: {
  /** On tient un dossier qui peut remonter au premier niveau. */
  accueille: boolean;
  onClick: () => void;
}) {
  const { sur } = useContext(Geste);
  const { setNodeRef: deposer } = useDroppable({
    id: "sur-racine",
    data: { cible: "racine" },
  });
  return (
    <button
      ref={deposer}
      type="button"
      onClick={onClick}
      className={cn(
        "mx-4 flex min-h-[52px] items-center justify-center gap-2.5 rounded-(--rayon-carte) border-[1.5px] border-dashed bg-white text-[15px] font-medium text-relvo active:bg-relvo-pale",
        accueille ? "border-relvo bg-relvo-pale" : "border-(--relvo-filet)",
        sur === "racine" && "ring-2 ring-relvo ring-inset",
      )}
    >
      {accueille ? (
        <ChevronDown className="size-[15px]" strokeWidth={2.4} />
      ) : (
        <Plus className="size-[15px]" strokeWidth={2.4} />
      )}
      {accueille ? "Déposer ici : premier niveau" : "Nouveau dossier"}
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pris, setPris] = useState<Prise | null>(null);
  const [sur, setSur] = useState<Cible | null>(null);
  // Lâcher une ligne sur elle-même fait naître un clic : il ne doit pas
  // ouvrir la fiche qu'on vient de tenir.
  const vientDeGlisser = useRef(false);
  const ouvreBientot = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 320, tolerance: 10 },
    }),
  );

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
  const gele = () => vientDeGlisser.current;
  // Le portail n'existe que dans le navigateur : faux au rendu serveur et à
  // l'hydratation, vrai ensuite — sans écart entre les deux.
  const monte = useSyncExternalStore(
    abonneARien,
    () => true,
    () => false,
  );
  const permis = (g: Glisse, c: Cible) =>
    depotPermis(g, c, folders, profondeurMax);

  function finDuGeste() {
    if (ouvreBientot.current) clearTimeout(ouvreBientot.current);
    setPris(null);
    setSur(null);
    setTimeout(() => {
      vientDeGlisser.current = false;
    }, 60);
  }

  function onDragStart(e: DragStartEvent) {
    vientDeGlisser.current = true;
    vibrer();
    setPris(e.active.data.current as Prise);
  }

  function onDragOver(e: DragOverEvent) {
    const g = (e.active.data.current as Prise).glisse;
    const c = (e.over?.data.current?.cible ?? null) as Cible | null;
    const vers = c != null && permis(g, c) ? c : null;
    if (vers === sur) return;
    setSur(vers);
    // Un dossier replié qu'on survole s'ouvre : on peut viser plus bas.
    if (ouvreBientot.current) clearTimeout(ouvreBientot.current);
    if (vers && vers !== "racine" && !deplies.has(vers)) {
      ouvreBientot.current = setTimeout(() => bascule(vers), 700);
    }
  }

  function onDragEnd() {
    const tenu = pris;
    const vers = sur;
    finDuGeste();
    if (tenu && vers) deplacer(tenu, vers);
  }

  function deplacer({ glisse, nom }: Prise, vers: Cible) {
    const ou =
      vers === "racine"
        ? "au premier niveau"
        : vers === AUCUN
          ? "sans dossier"
          : `dans ${parId.get(vers)?.path ?? "ce dossier"}`;
    // Où c'était : le dossier du sujet, ou le père du dossier (`null` = le
    // premier niveau, dont le père — Général — n'est pas dans la liste).
    const avant =
      glisse.type === "sujet"
        ? glisse.dossier
        : ((p) => (p && parId.has(p) ? p : null))(
            parId.get(glisse.id)?.parentId ?? null,
          );
    const range = (dest: string | null) =>
      glisse.type === "sujet"
        ? updateSubjectAction(glisse.id, { folderId: dest })
        : moveFolderAction(glisse.id, dest);
    startTransition(async () => {
      const res = await range(
        vers === "racine" || vers === AUCUN ? null : vers,
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (vers !== "racine")
        deplierVers(
          vers === AUCUN
            ? { type: "aucun" }
            : { type: "dossier", id: vers, chemin: "", dossierPossible: false },
        );
      router.refresh();
      toast.success(`« ${nom} » rangé ${ou}`, {
        duration: 8000,
        action: {
          label: "Annuler",
          onClick: () => {
            startTransition(async () => {
              const retour = await range(avant);
              if (retour.ok) {
                toast.success("Remis où il était");
                router.refresh();
              } else toast.error(retour.message);
            });
          },
        },
      });
    });
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
        <LigneDossier
          key={e.folder.id}
          folder={e.folder}
          tete={false}
          niveau={niveau}
          color={color}
          bouges={ouverts ? e.bouges : 0}
          ouvert={ouvert}
          pliable={aDessous(e)}
          onBascule={() => bascule(e.folder.id)}
        />,
      );
      if (ouvert) lignes.push(...branche(e, niveau + 1, color));
    }
    for (const row of n.sujets) {
      lignes.push(
        <LigneSujet
          key={row.id}
          row={row}
          cible={n.folder.id}
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
          cible={n.folder.id}
          niveau={niveau}
          color={color}
          onClick={() => setAjout(dans(n.folder))}
        />,
      );
    }
    return lignes;
  }

  return (
    // Un `id` stable : sans lui, dnd-kit numérote ses attributs ARIA et le
    // serveur ne compte pas comme le téléphone (PITFALLS #62).
    <DndContext
      id="sujets-arbre"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finDuGeste}
    >
      <Geste.Provider value={{ pris, sur, gele }}>
        <div
          className="flex flex-col gap-3"
          onClickCapture={(e) => {
            if (vientDeGlisser.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
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
              <TeteAucun
                bouges={ouverts ? sansDossier.filter((x) => x.moved).length : 0}
                ouvert={deplies.has(AUCUN)}
                onBascule={() => bascule(AUCUN)}
              />
              {deplies.has(AUCUN)
                ? sansDossier.map((row) => (
                    <LigneSujet
                      key={row.id}
                      row={row}
                      cible={AUCUN}
                      niveau={0}
                      color="var(--gris-clair)"
                      termine={!ouverts}
                    />
                  ))
                : null}
              {deplies.has(AUCUN) && ouverts ? (
                <LigneAjout
                  label="Ajouter un sujet sans dossier"
                  cible={AUCUN}
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
                <LigneDossier
                  folder={n.folder}
                  tete
                  color={color}
                  bouges={ouverts ? n.bouges : 0}
                  ouvert={ouvert}
                  pliable={aDessous(n)}
                  onBascule={() => bascule(n.folder.id)}
                />
                {ouvert ? branche(n, 0, color) : null}
              </ListPanel>
            );
          })}

          <PiedRacine
            accueille={pris != null && permis(pris.glisse, "racine")}
            onClick={aLaRacine}
          />

          <p className="px-[22px] text-center text-[12.5px] leading-[17px] font-normal text-gris">
            Au doigt, maintenez une ligne puis glissez-la sur un dossier. À la
            souris, tirez-la directement.
          </p>

          <AjouterDansSheet
            destination={ajout}
            onOpenChange={(o) => !o && setAjout(null)}
            onCree={() => ajout && deplierVers(ajout)}
          />
        </div>
      </Geste.Provider>

      {/* La miniature de ce qu'on tient : LA LIGNE ELLE-MÊME, à sa place et à
          sa taille — le point touché reste le point d'accroche. En portail :
          dans la zone qui défile, elle partait avec la page. */}
      {!monte
        ? null
        : createPortal(
            <DragOverlay dropAnimation={null}>
              {pris ? (
                <div
                  className={cn(
                    "souleve flex h-full w-full items-center rounded-(--rayon-sous-carte) bg-white pr-3.5",
                    pris.tete ? "gap-2.5" : "gap-[9px]",
                  )}
                  style={{ paddingLeft: pris.retrait }}
                >
                  {pris.glisse.type === "sujet" ? (
                    <FileTextTrait
                      aria-hidden
                      className="size-[19px] flex-none"
                      style={{ color: pris.color }}
                    />
                  ) : pris.tete ? (
                    <Folder
                      aria-hidden
                      className="size-6 flex-none"
                      style={{ color: pris.color }}
                    />
                  ) : (
                    <FolderTrait
                      aria-hidden
                      className="size-5 flex-none"
                      style={{ color: pris.color }}
                    />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-noir",
                      pris.tete
                        ? "font-heading text-[21px] leading-6"
                        : "text-[15.5px] leading-5",
                      pris.gras ? "font-semibold" : "font-normal",
                    )}
                  >
                    {pris.nom}
                  </span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
    </DndContext>
  );
}
