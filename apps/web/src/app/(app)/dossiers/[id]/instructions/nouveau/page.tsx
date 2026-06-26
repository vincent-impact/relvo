import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NoteForm } from "@/components/dossiers/note-form";
import { getTenantDb } from "@/server/auth-context";

export const metadata: Metadata = { title: "Nouvelle instruction — Relvo" };

// Création d'une instruction (M9.20) dans une page dédiée — espace plein écran
// (titre + corps), accessible via « + Ajouter une instruction » de la fiche
// domaine.
export default async function NouvelleInstructionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();
  const folder = await db.folder.findFirst({
    where: { id },
    select: { name: true },
  });
  if (!folder) notFound();

  return (
    <Screen>
      <RelvoHeader
        back={`/dossiers/${id}`}
        title="Nouvelle instruction"
        subtitle={folder.name}
        className="pb-9"
      />
      <NoteForm folderId={id} />
    </Screen>
  );
}
