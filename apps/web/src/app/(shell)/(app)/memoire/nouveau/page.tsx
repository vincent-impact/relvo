import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listFolderOptions } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NewFolderForm } from "@/components/memoire/new-folder-form";
import { getTenantDb } from "@/server/auth-context";

export const metadata: Metadata = { title: "Nouveau dossier — Relvo" };

// Création d'un domaine de la Mémoire (M9.20, M23.3) — nom + logo (couleur +
// icône), DANS un père quand on vient d'un dossier (`?dans=`), sinon sous
// Général. Accessible via l'invite en bas de chaque liste de dossiers.
export default async function NouveauDomainePage({
  searchParams,
}: {
  searchParams: Promise<{ dans?: string }>;
}) {
  const { dans } = await searchParams;
  const parent = dans
    ? ((await listFolderOptions(await getTenantDb())).find(
        (o) => o.id === dans,
      ) ?? null)
    : null;
  if (dans && !parent) notFound();

  return (
    <Screen entree>
      <RelvoHeader
        back={parent ? `/memoire/${parent.id}` : "/memoire"}
        title="Nouveau dossier"
        subtitle={parent ? `Dans ${parent.path}` : "Nom et logo du dossier"}
        className="pb-9"
      />
      <NewFolderForm parentId={parent?.id ?? null} />
    </Screen>
  );
}
