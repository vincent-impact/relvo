import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "@/components/shared/picto";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import { folderVisual } from "@/lib/folders";
import type { Folder } from "@relvo/db";
import {
  enrichSubjects,
  folderSubtreeIds,
  listFolderOptions,
  PROFONDEUR_MAX,
} from "@relvo/db";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  EditDomainButton,
  type MoveTarget,
} from "@/components/memoire/edit-domain-dialog";
import { AddFolderRow, FolderRow } from "@/components/memoire/folder-row";
import { InstructionList } from "@/components/memoire/instruction-list";
import { TabsSkeleton } from "@/components/shared/screen-skeletons";
import { SubjectRow, toSubjectRowData } from "@/components/shared/subject-row";
import { type SegTabOption } from "@/components/shared/seg-tabs";
import { ZoneHeading } from "@/components/shared/zone-heading";
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

// Fiche Mémoire / domaine (M9.7 → M9.20, M23.3, Direction B) — un domaine de
// la mémoire de Relvo : sa chaîne dans le ciel (on remonte d'un tap), SES
// DOMAINES en lignes (on y entre, on en crée dedans), puis 3 onglets :
// Instructions (consignes éditables, activables), Documents (fichiers
// absorbés ✦ / écartés) et Affaires (les siennes ET celles de ses domaines —
// la portée). Le domaine « Général » (is_default) masque l'onglet Affaires.
// L'upload de document arrive ensuite (coquille en M9).
//
// PERF (M9.19, point 2) : le hero (nom du dossier) s'affiche dès que la requête
// légère du dossier répond ; le contenu des onglets stream dans un <Suspense>.

async function DossierTabs({
  folder,
  overlap,
}: {
  folder: Folder;
  /** Les onglets chevauchent le ciel seulement quand rien ne les précède. */
  overlap: boolean;
}) {
  const db = await getTenantDb();
  const id = folder.id;

  const [docs, subjects] = await Promise.all([
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
  ]);

  const notes = docs.filter((d) => d.kind === "note");
  const files = docs.filter((d) => d.kind === "file");
  const rows = (await enrichSubjects(db, subjects)).map(toSubjectRowData);

  const options: SegTabOption[] = [
    { value: "instructions", label: "Instructions", count: notes.length },
    { value: "documents", label: "Documents", count: files.length },
  ];
  if (!folder.isDefault) {
    options.push({ value: "sujets", label: "Affaires", count: rows.length });
  }

  return (
    <FeedTabs
      options={options}
      overlap={overlap}
      panes={{
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
        documents:
          // Une liste = une carte ; la ligne est celle des documents d'un sujet.
          // Pas de « Déposer un document » tant que rien ne se dépose : un
          // contrôle sans effet se retire.
          files.length === 0 ? (
            <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
              Aucun document. Les pièces que Relvo lit pour ce dossier
              s’ajoutent ici.
            </p>
          ) : (
            <div className="pt-3 pb-2">
              <ListPanel>
                {files.map((f) => (
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
                    {/* « Lu » est une décision de Relvo : son logo, sur son fond. */}
                    {f.absorptionStatus === "read" ? (
                      <span className="inline-flex flex-none items-center gap-1 rounded-(--rayon-pilule) bg-relvo-pale px-2 py-0.5 text-[11px] font-medium text-relvo">
                        <RelvoLogo size={11} variant="full" title="" />
                        Lu
                      </span>
                    ) : (
                      <span className="flex-none rounded-(--rayon-pilule) bg-(--fond-puce) px-2 py-0.5 text-[11px] font-medium text-gris">
                        Écarté
                      </span>
                    )}
                  </div>
                ))}
              </ListPanel>
            </div>
          ),
        ...(folder.isDefault
          ? {}
          : {
              sujets:
                rows.length === 0 ? (
                  <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
                    Aucune affaire ouverte ici. Relvo en ouvrira une quand un
                    message concernera ce dossier.
                  </p>
                ) : (
                  <div className="pt-3 pb-2">
                    <ListPanel>
                      {rows.map((row) => (
                        <SubjectRow key={row.id} data={row} />
                      ))}
                    </ListPanel>
                  </div>
                ),
            }),
      }}
    />
  );
}

/** Les dossiers d'un dossier, en lignes — depuis le cache de la Mémoire. */
async function SousDossiers({
  accountId,
  folderId,
  depth,
}: {
  accountId: string;
  folderId: string;
  depth: number;
}) {
  const { folders } = await cachedMemoire(accountId);
  const fils = folders.filter((f) => f.parentId === folderId);
  const peutCreer = depth < PROFONDEUR_MAX;
  if (fils.length === 0 && !peutCreer) return null;
  return (
    <section className="pt-4">
      <ZoneHeading
        label="Dossiers"
        hint={fils.length > 0 ? `${fils.length}` : undefined}
      />
      <ListPanel>
        {fils.map((f) => (
          <FolderRow key={f.id} folder={f} />
        ))}
        {peutCreer ? (
          <AddFolderRow parentId={folderId} label="Ajouter un dossier ici" />
        ) : null}
      </ListPanel>
    </section>
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
  // La zone des sous-domaines existe dès qu'il y en a, ou qu'on peut en créer.
  const avecSousDossiers =
    !folder.isDefault &&
    (options.some((o) => o.parentId === id) || depth < PROFONDEUR_MAX);
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
      {/* La bande du domaine dans le ciel, comme sur sa ligne et comme sur la
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
            ) : (
              "Dossier"
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
              parentId={option?.parentId ?? null}
              parentLabel={pere?.name ?? "Général"}
              targets={targets}
              afterDelete={pere ? `/memoire/${pere.id}` : "/memoire"}
              rootDelete={pere == null}
            />
          )
        }
      />
      {avecSousDossiers ? (
        <Suspense fallback={null}>
          <SousDossiers
            accountId={accountId}
            folderId={folder.id}
            depth={depth}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={<TabsSkeleton />}>
        <DossierTabs folder={folder} overlap={!avecSousDossiers} />
      </Suspense>
    </Screen>
  );
}

// Affordance « + Ajouter… » (coquille M9 : édition de note / upload à venir).
