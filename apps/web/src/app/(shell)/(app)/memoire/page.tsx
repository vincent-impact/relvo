import type { Metadata } from "next";
import { Suspense } from "react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { AddFolderRow, FolderRow } from "@/components/memoire/folder-row";
import { InstructionList } from "@/components/memoire/instruction-list";
import { ListPanel } from "@/components/shared/list-panel";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { cachedMemoire } from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

export const metadata: Metadata = { title: "Mémoire — Relvo" };

// Mémoire — ce que Relvo sait de l'entreprise (01 §8), page du menu. Trois
// zones : les instructions du COMPTE en tête (celles du domaine « Général »,
// transversal : vous seul les écrivez, invariant 20), les domaines de PREMIER
// NIVEAU en lignes (M23.3 : on entre dans un domaine pour voir les siens),
// Général en dernier pour ses documents, et « Ce que Relvo a appris »,
// réservée à M17 — c'est elle qui donnera à cette page une raison d'être
// visitée.

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

async function MemoireBody({ accountId }: { accountId: string }) {
  const { defaultFolderId, folders: all } = await cachedMemoire(accountId);
  // Les dossiers de premier niveau, puis Général (ses documents).
  const folders = all.filter((f) => f.isDefault || f.depth === 1);
  const db = await getTenantDb();
  const notes = defaultFolderId
    ? await db.knowledgeDocument.findMany({
        where: { folderId: defaultFolderId, kind: "note" },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <div className="apparait-liste space-y-5 pt-4">
      <section>
        <ZoneHeading
          label="Votre entreprise"
          hint={plural(notes.length, "instruction")}
        />
        {defaultFolderId ? (
          <InstructionList
            folderId={defaultFolderId}
            notes={notes.map((n) => ({
              id: n.id,
              name: n.name,
              content: n.content,
              active: n.absorptionStatus === "read",
            }))}
            className="px-4 pt-0"
          />
        ) : null}
      </section>

      <section>
        <ZoneHeading
          label="Par domaine"
          hint={plural(folders.length, "domaine")}
        />
        <ListPanel>
          {folders.map((f) => (
            <FolderRow key={f.id} folder={f} />
          ))}
          {/* Même invite que « Ajouter une instruction » : une seule grammaire
              d'ajout sur l'écran, à portée du pouce en bas de la liste. */}
          <AddFolderRow label="Ajouter un domaine" />
        </ListPanel>
      </section>
    </div>
  );
}

export default async function MemoirePage() {
  const accountId = await requireAccountId();
  return (
    <Screen>
      {/* Pas de « + » dans le ciel : au-dessus d'une liste d'instructions, il
          menait à un domaine. L'ajout vit en bas de chaque liste. */}
      <RelvoHeader
        title="Mémoire"
        subtitle="Ce que Relvo sait de votre entreprise"
        className="pb-5"
      />
      <Suspense fallback={<RowsSkeleton count={4} />}>
        <MemoireBody accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
