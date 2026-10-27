import type { Metadata } from "next";
import { Suspense } from "react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { FolderTree } from "@/components/memoire/folder-tree";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedMemoire } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

export const metadata: Metadata = { title: "Dossiers — Relvo" };

// Dossiers — la mémoire de Relvo (01 §8), page du menu : UNE carte, tout
// l'arbre (M27.2, tranché sur maquettes). Général en tête de carte, la racine ;
// ses dossiers dessous, dépliés, le triangle à gauche pour replier une branche,
// la ligne pour entrer ; « Sans dossier » au pied, et l'ajout en bas. Les
// instructions du compte ne vivent plus ici : elles sont celles de Général, on
// les lit en entrant dans Général.

async function DossiersBody({ accountId }: { accountId: string }) {
  const { folders, unfiledOpenSubjects } = await cachedMemoire(accountId);
  const general = folders.find((f) => f.isDefault) ?? null;
  return (
    <div className="apparait">
      <FolderTree
        general={general}
        folders={folders.filter((f) => !f.isDefault)}
        unfiled={unfiledOpenSubjects}
        ajout={{
          label: "Ajouter un dossier dans Général",
          parentId: null,
          position: "bas",
        }}
        className="relative z-3 -mt-7.5"
      />
    </div>
  );
}

export default async function MemoirePage() {
  const accountId = await requireAccountId();
  return (
    <Screen>
      {/* Pas de « + » dans le ciel : l'ajout vit au pied de l'arbre, et il
          nomme le père (« dans Général »). */}
      <RelvoHeader
        title="Dossiers"
        subtitle="Vos sujets, rangés"
        className="pb-9"
      />
      <Suspense fallback={<RowsSkeleton count={6} />}>
        <DossiersBody accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
