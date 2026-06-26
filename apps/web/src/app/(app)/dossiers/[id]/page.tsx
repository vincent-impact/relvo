import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FileText, Plus, Sparkles } from "lucide-react";
import type { Folder } from "@relvo/db";
import { enrichSubjects } from "@relvo/db";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { EditDomainButton } from "@/components/dossiers/edit-domain-dialog";
import { InstructionList } from "@/components/dossiers/instruction-list";
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
        documents: (
          <div className="px-4 pt-4">
            {files.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-(--text-tertiary)">
                Aucun document.
              </p>
            ) : (
              <div className="space-y-2.5">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-2xl border border-(--border-light) bg-white px-3 py-3 shadow-(--shadow-card)"
                  >
                    <span className="grid size-[38px] flex-none place-items-center rounded-lg bg-[#f0eeea] text-[#86857d]">
                      <FileText className="size-[18px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">
                        {f.name}
                      </div>
                      <div className="text-[11.5px] text-(--text-tertiary)">
                        {formatRelative(f.updatedAt)}
                        {f.aiLabel ? ` · ${f.aiLabel}` : ""}
                      </div>
                    </div>
                    {f.absorptionStatus === "read" ? (
                      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-relvo-bg px-2 py-0.5 text-[11px] font-bold text-relvo">
                        <Sparkles
                          className="size-3"
                          fill="currentColor"
                          strokeWidth={0}
                        />
                        Lu
                      </span>
                    ) : (
                      <span className="flex-none rounded-full bg-(--surface-2) px-2 py-0.5 text-[11px] font-bold text-(--text-tertiary)">
                        Écarté
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <AddRow label="Déposer un document (PDF, image)" />
          </div>
        ),
        ...(folder.isDefault
          ? {}
          : {
              sujets: (
                <div className="pt-1">
                  {rows.length === 0 ? (
                    <p className="px-[22px] py-6 text-center text-[13.5px] text-(--text-tertiary)">
                      Aucun sujet dans ce dossier.
                    </p>
                  ) : (
                    rows.map((row) => <SubjectRow key={row.id} data={row} />)
                  )}
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
      <RelvoHeader
        back="/dossiers"
        title={folder.name}
        subtitle="Un domaine de la mémoire de Relvo"
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
function AddRow({ label }: { label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-(--border) px-3.5 py-3.5 text-[13.5px] font-semibold text-(--text-tertiary)">
      <span className="grid size-6 flex-none place-items-center rounded-full bg-(--surface-2)">
        <Plus className="size-[15px]" strokeWidth={2.4} />
      </span>
      {label}
    </div>
  );
}
