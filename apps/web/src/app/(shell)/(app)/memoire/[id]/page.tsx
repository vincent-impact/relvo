import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "@/components/shared/picto";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import { RelvoBlock } from "@/components/shared/relvo-block";
import { folderVisual } from "@/lib/folders";
import type { Folder as FolderModel } from "@relvo/db";
import {
  enrichSubjects,
  folderSubtreeIds,
  listFolderOptions,
  PROFONDEUR_MAX,
} from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  EditDomainButton,
  type MoveTarget,
} from "@/components/memoire/edit-domain-dialog";
import {
  DossierTabs as OngletsDossier,
  type OngletDossier,
} from "@/components/memoire/dossier-tabs";
import { AddFolderRow } from "@/components/memoire/folder-row";
import { DeposerConnaissance } from "@/components/memoire/deposer-connaissance";
import { FolderDescription } from "@/components/memoire/folder-description";
import { FolderTree } from "@/components/memoire/folder-tree";
import { InstructionList } from "@/components/memoire/instruction-list";
import { TabsSkeleton } from "@/components/shared/screen-skeletons";
import { toSubjectRowData } from "@/components/shared/subject-row";
import { SujetsRangeables } from "@/components/memoire/sujets-rangeables";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatRelative } from "@/lib/display";
import { cachedMemoire } from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

// La fiche d'un dossier (M9.7 → M9.20, M23.3, M27.3 — tranché sur maquettes) :
// sa chaîne dans le ciel (on remonte d'un tap), SA DESCRIPTION en première
// carte (c'est elle qui aide Relvo à ranger), puis QUATRE onglets à icône, du
// contenant au contenu — Dossiers (son arbre, même mécanique que la page
// Dossiers), Sujets (les siens et ceux de ses fils : la portée), Instructions,
// Connaissances — et UN AJOUT EN PREMIÈRE LIGNE de chaque onglet, qu'une
// longue liste ne pousse pas sous le dock. La fiche s'ouvre sur Sujets, ce
// qu'on vient chercher ; Général, qui ne range aucun sujet, s'ouvre sur ses
// instructions et n'a pas l'onglet Sujets.
//
// PERF (M9.19, point 2) : le ciel s'affiche dès que la requête légère du
// dossier répond ; le contenu des onglets stream dans un <Suspense>.

async function DossierTabs({
  folder,
  accountId,
  depth,
}: {
  folder: FolderModel;
  accountId: string;
  depth: number;
}) {
  const db = await getTenantDb();
  const id = folder.id;

  const [docs, subjects, memoire] = await Promise.all([
    db.knowledgeDocument.findMany({
      where: { folderId: id },
      orderBy: { updatedAt: "desc" },
    }),
    folder.isDefault
      ? Promise.resolve([])
      : db.subject.findMany({
          // Le dossier et ses fils : la portée (M23.4).
          where: { folderId: { in: await folderSubtreeIds(db, id) } },
          orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
        }),
    cachedMemoire(accountId),
  ]);

  const notes = docs.filter((d) => d.kind === "note");
  const files = docs.filter((d) => d.kind === "file");
  // Le dossier est déjà dit par la fiche : la ligne d'un sujet n'écrit que ce
  // qui descend sous lui (« Kiloutou › Agence de Narbonne »), rien quand le
  // sujet est rangé ici même — une présentation unique, seul le contexte varie.
  const prefixe = memoire.folders.find((f) => f.id === id)?.path ?? "";
  const rows = (await enrichSubjects(db, subjects))
    .map(toSubjectRowData)
    .map((r) => ({
      ...r,
      folderPath:
        r.folderPath && prefixe && r.folderPath.startsWith(prefixe)
          ? r.folderPath.slice(prefixe.length).replace(/^ › /, "")
          : r.folderPath,
    }));
  // L'arbre du dossier : ses fils et leurs fils, en ordre d'arbre (Général :
  // tout l'arbre, la même carte que la page Dossiers).
  const sousArbre = folder.isDefault
    ? memoire.folders.filter((f) => !f.isDefault)
    : memoire.folders.filter((f) => {
        let p = f.parentId;
        while (p) {
          if (p === id) return true;
          p = memoire.folders.find((o) => o.id === p)?.parentId ?? null;
        }
        return false;
      });
  const fils = sousArbre.filter((f) => f.parentId === id).length;
  const peutCreer = depth < PROFONDEUR_MAX;

  const options: OngletDossier[] = [
    { value: "dossiers", label: "Dossiers", count: fils },
    ...(folder.isDefault
      ? []
      : [{ value: "sujets" as const, label: "Sujets", count: rows.length }]),
    { value: "instructions", label: "Instructions", count: notes.length },
    { value: "connaissances", label: "Connaissances", count: files.length },
  ];

  return (
    <OngletsDossier
      options={options}
      overlap={folder.isDefault}
      defaultValue={folder.isDefault ? "instructions" : "sujets"}
      panes={{
        dossiers: (
          <div className="pt-3 pb-2">
            {sousArbre.length === 0 && !peutCreer ? (
              <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
                Ce dossier est au dernier niveau : on n’y range plus de dossier.
              </p>
            ) : (
              <FolderTree
                folders={sousArbre}
                ajout={
                  peutCreer
                    ? {
                        label: "Ajouter un dossier ici",
                        parentId: folder.isDefault ? null : id,
                        position: "haut",
                      }
                    : null
                }
              />
            )}
          </div>
        ),
        instructions: (
          <InstructionList
            folderId={id}
            notes={notes.map((n) => ({
              id: n.id,
              name: n.name,
              content: n.content,
              active: n.absorptionStatus === "read",
            }))}
          />
        ),
        connaissances: (
          // Une liste = une carte : « Ajouter une connaissance » en tête (M27.5),
          // puis les fichiers, chacun avec son état — à lire (déposé), lu par
          // Relvo (son logo, sur son fond), écarté.
          <div className="pt-3 pb-2">
            <ListPanel>
              <DeposerConnaissance folderId={id} />
              {files.length === 0 ? (
                <p className="px-[22px] py-8 text-center text-[14px] font-light text-gris">
                  Aucune connaissance. Déposez un PDF, une image ou un texte :
                  Relvo le lira pour ce dossier.
                </p>
              ) : (
                files.map((f) => (
                  <div
                    key={f.id}
                    data-list-row
                    className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5"
                  >
                    <span className="grid size-[34px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-(--fond-puce) text-gris">
                      <FileText className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] leading-[18px] font-normal text-noir">
                        {f.name}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-4 font-normal text-gris">
                        {formatRelative(f.updatedAt)}
                        {f.aiLabel ? ` · ${f.aiLabel}` : ""}
                      </div>
                    </div>
                    {f.absorptionStatus === "read" ? (
                      <span className="inline-flex flex-none items-center gap-1 rounded-(--rayon-pilule) bg-relvo-pale px-2 py-0.5 text-[11px] font-medium text-relvo">
                        <RelvoLogo size={11} variant="full" title="" />
                        Lu
                      </span>
                    ) : f.absorptionStatus === "pending" ? (
                      <span className="flex-none rounded-(--rayon-pilule) border border-dashed border-(--gris-clair) px-2 py-0.5 text-[11px] font-medium text-gris">
                        À lire
                      </span>
                    ) : (
                      <span className="flex-none rounded-(--rayon-pilule) bg-(--fond-puce) px-2 py-0.5 text-[11px] font-medium text-gris">
                        Écarté
                      </span>
                    )}
                  </div>
                ))
              )}
            </ListPanel>
          </div>
        ),
        ...(folder.isDefault
          ? {}
          : {
              sujets: (
                <div className="pt-3 pb-2">
                  <ListPanel>
                    <AddFolderRow
                      href={`/sujets/nouveau?dossier=${id}`}
                      label="Ajouter un sujet ici"
                    />
                    {rows.length > 0 ? (
                      // Glisser une ligne à droite : « Ranger » (M27.4).
                      <SujetsRangeables
                        rows={rows}
                        dossiers={memoire.folders.filter((f) => !f.isDefault)}
                      />
                    ) : null}
                  </ListPanel>
                  {/* L'état vide guide, dans la voix de Relvo, quand c'est Relvo qui
                      remplit (02-composants) — sous la carte, jamais dedans. */}
                  {rows.length === 0 ? (
                    <RelvoBlock className="mx-4 mt-3">
                      Aucun sujet ici pour l’instant. J’en ouvrirai un dès qu’un
                      message concernera ce dossier.
                    </RelvoBlock>
                  ) : null}
                </div>
              ),
            }),
      }}
    />
  );
}

export default async function DossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await requireAccountId();
  const db = await getTenantDb();

  const [folder, options] = await Promise.all([
    db.folder.findFirst({ where: { id } }),
    listFolderOptions(db),
  ]);
  if (!folder) notFound();

  const option = options.find((o) => o.id === id) ?? null;
  const depth = option?.depth ?? 0;
  // La chaîne des pères, du premier niveau au père direct — le fil d'Ariane.
  const peres: { id: string; name: string }[] = [];
  let courant = option?.parentId ?? null;
  while (courant) {
    const p = options.find((o) => o.id === courant);
    if (!p) break;
    peres.unshift({ id: p.id, name: p.name });
    courant = p.parentId;
  }
  const pere = peres[peres.length - 1] ?? null;
  // Les pères possibles : ni lui-même, ni un de ses fils, ni trop profond.
  // La hauteur de son sous-arbre compte : déplacer un dossier qui a des fils
  // demande de la place en dessous.
  const sousArbre = new Set(
    options
      .filter((o) => o.id === id || o.chainIds.includes(id))
      .map((o) => o.id),
  );
  const hauteur = Math.max(
    0,
    ...options.filter((o) => sousArbre.has(o.id)).map((o) => o.depth - depth),
  );
  const targets: MoveTarget[] = [
    { id: null, label: "Général (à la racine)" },
    ...options
      .filter(
        (o) => !sousArbre.has(o.id) && o.depth + 1 + hauteur <= PROFONDEUR_MAX,
      )
      .map((o) => ({ id: o.id, label: o.path })),
  ];
  // La bande : celle du premier niveau, comme sur toute ligne (M23.4).
  const bande = folderVisual({
    slug: option?.slug ?? folder.slug,
    color: option?.color ?? folder.color,
    icon: option?.icon ?? folder.icon,
  }).color;

  return (
    <Screen entree>
      {/* La bande du dossier dans le ciel, comme sur sa ligne et comme sur la
          fiche d'un sujet : le fil de couleur ne se rompt pas à sa porte. Les
          pères, à sa suite, se remontent d'un tap. */}
      <RelvoHeader
        back={pere ? `/memoire/${pere.id}` : "/memoire"}
        title={folder.name}
        eyebrow={
          <span className="inline-flex max-w-full items-center gap-2">
            <i
              aria-hidden
              className="h-2 w-5 flex-none rounded-full"
              style={{ background: bande }}
            />
            {peres.length > 0 ? (
              <Breadcrumb className="min-w-0">
                {/* Un séparateur est un <li> frère de l'item, jamais son
                    enfant : un <li> dans un <li> casse l'hydratation. */}
                <BreadcrumbList className="flex-nowrap gap-1 text-inherit sm:gap-1">
                  {peres.flatMap((p) => [
                    <BreadcrumbItem key={p.id} className="min-w-0">
                      <BreadcrumbLink
                        render={<Link href={`/memoire/${p.id}`} />}
                        className="truncate text-white/90 hover:text-white"
                      >
                        {p.name}
                      </BreadcrumbLink>
                    </BreadcrumbItem>,
                    <BreadcrumbSeparator
                      key={`${p.id}-sep`}
                      className="text-white/60"
                    />,
                  ])}
                </BreadcrumbList>
              </Breadcrumb>
            ) : folder.isDefault ? (
              "La racine"
            ) : (
              "Général ›"
            )}
          </span>
        }
        className="pb-9"
        action={
          folder.isDefault ? undefined : (
            <EditDomainButton
              id={folder.id}
              name={folder.name}
              color={folder.color}
              icon={folder.icon}
              // Le père tel que la feuille le dit : null sous Général (les
              // options portent l'identifiant de Général, la feuille non).
              parentId={pere?.id ?? null}
              parentLabel={pere?.name ?? "Général"}
              targets={targets}
              arbre={options}
              afterDelete={pere ? `/memoire/${pere.id}` : "/memoire"}
              rootDelete={pere == null}
            />
          )
        }
      />
      {/* Général n'a pas de description à écrire : il est la racine, et ses
          instructions valent pour tous. Sa carte d'onglets chevauche le ciel. */}
      {folder.isDefault ? null : (
        <FolderDescription
          folderId={folder.id}
          description={folder.description}
          className="relative z-3 -mt-7.5"
        />
      )}
      <Suspense fallback={<TabsSkeleton />}>
        <DossierTabs folder={folder} accountId={accountId} depth={depth} />
      </Suspense>
    </Screen>
  );
}
