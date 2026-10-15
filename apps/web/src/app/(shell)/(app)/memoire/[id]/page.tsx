import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FileText } from "@/components/shared/picto";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import { folderVisual } from "@/lib/folders";
import type { Folder } from "@relvo/db";
import { enrichSubjects } from "@relvo/db";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { EditDomainButton } from "@/components/memoire/edit-domain-dialog";
import { InstructionList } from "@/components/memoire/instruction-list";
import { TabsSkeleton } from "@/components/shared/screen-skeletons";
import { SubjectRow, toSubjectRowData } from "@/components/shared/subject-row";
import { type SegTabOption } from "@/components/shared/seg-tabs";
import { formatRelative } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Mémoire / domaine (M9.7 → M9.20, Direction B) — un domaine de la mémoire
// de Relvo, en 3 onglets : Instructions (consignes éditables, activables),
// Documents (fichiers absorbés ✦ / écartés) et Sujets (lignes). Le domaine
// « Général » (is_default) masque l'onglet Sujets. L'upload de document arrive
// ensuite (coquille en M9).
//
// PERF (M9.19, point 2) : le hero (nom du dossier) s'affiche dès que la requête
// légère du dossier répond ; le contenu des onglets stream dans un <Suspense>.

async function DossierTabs({ folder }: { folder: Folder }) {
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
          where: { folderId: id },
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
    options.push({ value: "sujets", label: "Sujets", count: rows.length });
  }

  return (
    <FeedTabs
      options={options}
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
              Aucun document. Les pièces que Relvo lit pour ce domaine
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
                    Aucun sujet ouvert ici. Relvo en ouvrira quand un message
                    concernera ce domaine.
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

export default async function DossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const folder = await db.folder.findFirst({ where: { id } });
  if (!folder) notFound();

  return (
    <Screen>
      {/* La bande du domaine dans le ciel, comme sur sa ligne et comme sur la
          fiche d'un sujet : le fil de couleur ne se rompt pas à sa porte. */}
      <RelvoHeader
        back="/memoire"
        title={folder.name}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <i
              aria-hidden
              className="h-2 w-5 flex-none rounded-full"
              style={{
                background: folderVisual({
                  slug: folder.slug,
                  color: folder.color,
                  icon: folder.icon,
                }).color,
              }}
            />
            Domaine
          </span>
        }
        className="pb-9"
        action={
          <EditDomainButton
            id={folder.id}
            name={folder.name}
            color={folder.color}
            icon={folder.icon}
          />
        }
      />
      <Suspense fallback={<TabsSkeleton />}>
        <DossierTabs folder={folder} />
      </Suspense>
    </Screen>
  );
}

// Affordance « + Ajouter… » (coquille M9 : édition de note / upload à venir).
