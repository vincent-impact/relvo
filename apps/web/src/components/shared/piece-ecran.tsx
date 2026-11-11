"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { FeuilleApercu } from "@relvo/storage/classeur";
import {
  DownloadSimple,
  Export,
  FileText,
  Table as TablePicto,
} from "@/components/shared/picto";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  estUnNombre,
  formatPoids,
  lettreDeColonne,
  libelleDeType,
  phraseSansApercu,
  type ApercuPiece,
  type EchecApercu,
  type GenrePiece,
} from "@/lib/pieces";
import { cn } from "@/lib/utils";

// L'écran d'une pièce qui ne s'affiche ni comme une image ni comme un PDF
// (recette R18). Plein écran, DANS l'application : on ne part plus vers le
// navigateur, où un classeur ouvrait une page blanche. Deux visages :
//   • un CLASSEUR → son tableau, une puce par feuille ;
//   • tout autre fichier, et tout aperçu qui échoue → la FICHE du fichier : son
//     nom, son type, son poids, « Ouvrir avec… » et « Télécharger ».
//
// ⚠️ Le fichier est chargé DÈS L'OUVERTURE, pas au tap sur « Ouvrir avec… » :
// sur iOS, la feuille de partage exige d'être appelée dans le geste même. Un
// téléchargement entre le tap et l'appel, et le système refuse.

type EtatApercu =
  | { etat: "charge" }
  | { etat: "pret"; apercu: ApercuPiece }
  | { etat: "echec" };

type EtatFichier =
  | { etat: "charge" }
  | { etat: "pret"; fichier: File; adresse: string }
  | { etat: "trop_lourd" }
  | { etat: "echec" };

/** Ce que l'écran charge à son ouverture : l'aperçu, et le fichier lui-même. */
function usePiece(base: string, nom: string, mimeType: string | null) {
  const [apercu, setApercu] = useState<EtatApercu>({ etat: "charge" });
  const [fichier, setFichier] = useState<EtatFichier>({ etat: "charge" });

  useEffect(() => {
    const abandon = new AbortController();
    const { signal } = abandon;
    let adresse: string | null = null;

    fetch(`${base}/apercu`, { signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setApercu({ etat: "pret", apercu: (await r.json()) as ApercuPiece });
      })
      .catch(() => {
        if (!signal.aborted) setApercu({ etat: "echec" });
      });

    const prendre = async (r: Response) => {
      const fichier = new File([await r.blob()], nom, {
        type: mimeType || "application/octet-stream",
      });
      adresse = URL.createObjectURL(fichier);
      // Démonté pendant la lecture : personne ne libérera cette adresse.
      if (signal.aborted) return URL.revokeObjectURL(adresse);
      setFichier({ etat: "pret", fichier, adresse });
    };

    (async () => {
      const r = await fetch(`${base}/contenu`, { signal });
      if (r.ok) return prendre(r);
      if (r.status !== 413) return setFichier({ etat: "echec" });
      // Trop lourd pour passer par le serveur. Reste la lecture directe dans
      // le stockage, qui n'aboutit que s'il l'autorise (`PITFALLS.md` #77).
      try {
        const direct = await fetch(`${base}/download?inline=1`, { signal });
        if (direct.ok) return prendre(direct);
      } catch {
        // Refusée par le stockage : c'est le cas attendu aujourd'hui.
      }
      if (!signal.aborted) setFichier({ etat: "trop_lourd" });
    })().catch(() => {
      if (!signal.aborted) setFichier({ etat: "echec" });
    });

    return () => {
      abandon.abort();
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [base, nom, mimeType]);

  return { apercu, fichier };
}

/** La feuille de partage sait-elle prendre un fichier, sur cet appareil ? */
function peutPartager(fichier: File): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [fichier] })
  );
}

export function PieceEcran({
  open,
  onOpenChange,
  base,
  name,
  mimeType,
  genre,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** L'adresse stable de la pièce (`adresseDePiece`). */
  base: string;
  name: string;
  mimeType: string | null;
  genre: GenrePiece;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 flex h-(--app-height,100dvh) max-w-120 translate-y-0 flex-col gap-0 rounded-none bg-white p-0 ring-0 sm:max-w-120"
      >
        {/* Monté à l'ouverture seulement : rien ne se charge pour une pièce
            qu'on n'a pas touchée. */}
        {open ? (
          <Contenu base={base} name={name} mimeType={mimeType} genre={genre} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Contenu({
  base,
  name,
  mimeType,
  genre,
}: {
  base: string;
  name: string;
  mimeType: string | null;
  genre: GenrePiece;
}) {
  const { apercu, fichier } = usePiece(base, name, mimeType);
  const [partageRate, setPartageRate] = useState(false);

  const donnees = apercu.etat === "pret" ? apercu.apercu : null;
  const classeur = donnees?.classeur ?? null;
  const echec: EchecApercu | null =
    apercu.etat === "echec" ? "reseau" : (donnees?.echec ?? null);
  const absent = echec === "absent";
  // Un classeur dont on attend l'aperçu : rien d'autre à montrer que l'attente.
  const enAttente = genre === "classeur" && apercu.etat === "charge";

  const pret = fichier.etat === "pret" ? fichier : null;
  const partageable = useMemo(
    () => (pret ? peutPartager(pret.fichier) : false),
    [pret],
  );
  // Tant que le fichier charge, on ne sait pas encore : le bouton attend, il
  // n'apparaît pas pour disparaître. Sans feuille de partage, il n'existe pas.
  const partagePossible =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const montrerPartage =
    !absent && partagePossible && (fichier.etat === "charge" || partageable);

  async function ouvrirAvec() {
    if (!pret) return;
    setPartageRate(false);
    try {
      // Le fichier seul : un titre ou un texte en plus, et iOS partage aussi
      // un fichier texte dont personne ne veut.
      await navigator.share({ files: [pret.fichier] });
    } catch (erreur) {
      // Feuille refermée sans rien choisir : ce n'est pas un échec.
      if ((erreur as { name?: string }).name !== "AbortError") {
        setPartageRate(true);
      }
    }
  }

  const sousTitre = [
    libelleDeType(name, mimeType),
    donnees?.taille != null ? formatPoids(donnees.taille) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const telechargement = pret
    ? { href: pret.adresse, download: name }
    : // Pas en main (trop lourd, ou encore en route) : la route stable, qui
      // fait télécharger sous le vrai nom.
      { href: `${base}/download`, download: name };

  return (
    <>
      <header
        className={cn(
          "flex flex-none items-center gap-1 pr-2 pb-2 pl-1",
          (classeur || enAttente) && "border-b border-(--filet)",
        )}
        style={{ paddingTop: "calc(max(env(safe-area-inset-top), 8px))" }}
      >
        <DialogClose
          aria-label="Fermer"
          className="grid size-11 flex-none place-items-center rounded-full text-noir active:bg-(--fond-puce)"
        >
          <X className="size-[22px]" strokeWidth={2.2} />
        </DialogClose>
        {/* Sur la fiche, le nom et le type sont écrits en grand au centre :
            l'en-tête ne les redit qu'aux lecteurs d'écran. */}
        <div
          className={cn("min-w-0 flex-1", !classeur && !enAttente && "sr-only")}
        >
          <DialogTitle className="truncate text-[15.5px] leading-5 font-medium text-noir">
            {name}
          </DialogTitle>
          <DialogDescription className="truncate text-[12px] leading-4 font-normal text-gris">
            {sousTitre}
          </DialogDescription>
        </div>
        {/* Devant un tableau, les deux gestes tiennent dans l'en-tête ; sur la
            fiche, ils sont les boutons du bas. */}
        {classeur ? (
          <>
            {montrerPartage ? (
              <button
                type="button"
                onClick={ouvrirAvec}
                disabled={!pret}
                aria-label="Ouvrir avec…"
                className="grid size-11 flex-none place-items-center rounded-full text-relvo active:bg-(--fond-puce) disabled:text-(--gris-clair)"
              >
                {pret ? (
                  <Export className="size-[22px]" />
                ) : (
                  <Loader2 className="size-[18px] animate-spin" />
                )}
              </button>
            ) : null}
            <a
              {...telechargement}
              aria-label="Télécharger"
              className="grid size-11 flex-none place-items-center rounded-full text-relvo active:bg-(--fond-puce)"
            >
              <DownloadSimple className="size-[22px]" />
            </a>
          </>
        ) : null}
      </header>

      {classeur ? (
        <>
          {partageRate ? (
            <p
              role="alert"
              className="flex-none border-b border-(--filet) bg-(--fond-enfonce) px-4 py-2 text-[13px] leading-[18px] font-normal text-noir"
            >
              Le partage n&apos;a pas abouti. Téléchargez le fichier.
            </p>
          ) : null}
          <ClasseurVue
            feuilles={classeur.feuilles}
            total={classeur.feuillesTotal}
          />
        </>
      ) : enAttente ? (
        <div
          role="status"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-gris"
        >
          <Loader2 className="size-6 animate-spin" />
          <p className="text-[14px] font-normal">Ouverture du classeur…</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col items-center justify-center px-7 py-8 text-center">
            <span className="grid size-[72px] place-items-center rounded-(--rayon-carte) bg-(--fond-puce) text-gris">
              {genre === "classeur" ? (
                <TablePicto className="size-9" />
              ) : (
                <FileText className="size-9" />
              )}
            </span>
            <p className="mt-5 text-[18px] leading-6 font-medium [overflow-wrap:anywhere] break-words text-noir">
              {name}
            </p>
            <p className="mt-1 text-[14px] leading-5 font-normal text-gris">
              {sousTitre}
            </p>
            <p className="mt-4 max-w-[280px] text-[14px] leading-5 font-light text-gris">
              {phraseSansApercu(genre, echec)}
            </p>
          </div>

          {absent ? null : (
            <div
              className="flex flex-none flex-col gap-2.5 px-5"
              style={{
                paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
              }}
            >
              {partageRate ? (
                <p
                  role="alert"
                  className="text-center text-[13px] leading-[18px] font-normal text-noir"
                >
                  Le partage n&apos;a pas abouti. Téléchargez le fichier.
                </p>
              ) : null}
              {fichier.etat === "trop_lourd" && partagePossible ? (
                <p className="text-center text-[13px] leading-[18px] font-light text-gris">
                  Trop lourd pour « Ouvrir avec… » depuis Relvo :
                  téléchargez-le.
                </p>
              ) : null}
              {montrerPartage ? (
                <Button
                  type="button"
                  onClick={ouvrirAvec}
                  disabled={!pret}
                  className="h-12 w-full text-[15px]"
                >
                  {pret ? (
                    <Export className="size-[18px]" />
                  ) : (
                    <Loader2 className="size-[18px] animate-spin" />
                  )}
                  Ouvrir avec…
                </Button>
              ) : null}
              <Button
                variant={montrerPartage ? "secondary" : "default"}
                nativeButton={false}
                render={<a {...telechargement} />}
                className="h-12 w-full text-[15px]"
              >
                <DownloadSimple className="size-[18px]" />
                Télécharger
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Le pas d'affichage : un tableau de 500 lignes ne se pose pas d'un bloc sur un téléphone. */
const PAS_LIGNES = 120;

function ClasseurVue({
  feuilles,
  total,
}: {
  feuilles: FeuilleApercu[];
  total: number;
}) {
  const [active, setActive] = useState("0");

  return (
    <Tabs
      value={active}
      onValueChange={(v) => setActive(String(v))}
      className="min-h-0 flex-1 gap-0"
    >
      {/* Une seule feuille : pas d'onglets, toute la hauteur au tableau. */}
      {feuilles.length > 1 ? (
        <div className="flex-none [scrollbar-width:none] overflow-x-auto border-b border-(--filet)">
          <TabsList className="h-auto w-max justify-start gap-1.5 rounded-none bg-transparent px-3 py-2 group-data-horizontal/tabs:h-auto">
            {feuilles.map((f, i) => (
              <TabsTrigger
                key={i}
                value={String(i)}
                className="h-8 flex-none rounded-(--rayon-pilule) bg-(--fond-puce) px-3 text-[13px] font-medium text-noir after:hidden data-active:bg-noir data-active:text-white"
              >
                {f.nom}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      ) : null}
      {feuilles.map((f, i) => (
        <TabsContent
          key={i}
          value={String(i)}
          className="flex min-h-0 flex-col"
        >
          <FeuilleVue feuille={f} />
        </TabsContent>
      ))}
      {total > feuilles.length ? (
        <p className="flex-none border-t border-(--filet) px-4 py-2 text-[12px] leading-4 font-normal text-gris">
          {feuilles.length} feuilles montrées sur {total}.
        </p>
      ) : null}
    </Tabs>
  );
}

function FeuilleVue({ feuille }: { feuille: FeuilleApercu }) {
  const [montrees, setMontrees] = useState(PAS_LIGNES);
  const sentinelle = useRef<HTMLTableRowElement>(null);
  const lignes = feuille.lignes.slice(0, montrees);
  const largeur = feuille.lignes[0]?.length ?? 0;
  const reste = feuille.lignes.length > montrees;

  // La suite arrive en défilant : pas de bouton, pas de tap de plus.
  useEffect(() => {
    const el = sentinelle.current;
    if (!el || !reste) return;
    const veille = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setMontrees((n) => n + PAS_LIGNES);
        }
      },
      // Lue par rapport au conteneur qui défile, pas à la fenêtre : sinon elle
      // serait toujours « en vue » et tout se poserait d'un coup.
      {
        root: el.closest("[data-slot=table-container]"),
        rootMargin: "600px",
      },
    );
    veille.observe(el);
    return () => veille.disconnect();
  }, [reste, montrees]);

  if (feuille.lignes.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-[14px] font-light text-gris">
        Cette feuille est vide.
      </p>
    );
  }

  const coupes = [
    feuille.lignesTotal > feuille.lignes.length
      ? `${feuille.lignes.length} premières lignes sur ${feuille.lignesTotal}`
      : null,
    feuille.colonnesTotal > largeur
      ? `${largeur} premières colonnes sur ${feuille.colonnesTotal}`
      : null,
  ].filter(Boolean);

  return (
    <>
      <Table
        containerClassName="min-h-0 flex-1 overflow-auto overscroll-contain"
        className="w-max min-w-full border-separate border-spacing-0 text-[13px] text-noir"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 left-0 z-2 h-7 border-r border-b border-(--filet) bg-(--fond-puce) px-0" />
            {Array.from({ length: largeur }, (_, c) => (
              <TableHead
                key={c}
                className="chiffre sticky top-0 z-1 h-7 border-r border-b border-(--filet) bg-(--fond-puce) px-2 text-center text-[12px] text-gris"
              >
                {lettreDeColonne(c)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne, r) => (
            <TableRow key={r} className="hover:bg-transparent">
              <TableCell className="chiffre sticky left-0 z-1 min-w-9 border-r border-b border-(--filet) bg-(--fond-puce) px-1.5 py-1.5 text-center text-[12px] text-gris">
                {r + 1}
              </TableCell>
              {ligne.map((texte, c) => (
                <TableCell
                  key={c}
                  className={cn(
                    "max-w-[260px] truncate border-r border-b border-(--filet) px-2.5 py-1.5 font-normal",
                    estUnNombre(texte) && "text-right tabular-nums",
                  )}
                >
                  {texte}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {reste ? (
            <TableRow ref={sentinelle} aria-hidden className="h-px border-0" />
          ) : null}
        </TableBody>
      </Table>
      {coupes.length > 0 ? (
        <p
          className="flex-none border-t border-(--filet) px-4 pt-2 text-[12px] leading-4 font-normal text-gris"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        >
          Aperçu : {coupes.join(", ")}. Ouvrez le fichier pour tout voir.
        </p>
      ) : null}
    </>
  );
}
