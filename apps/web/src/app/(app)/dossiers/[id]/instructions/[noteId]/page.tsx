import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NoteForm } from "@/components/dossiers/note-form";
import { getTenantDb } from "@/server/auth-context";

export const metadata: Metadata = { title: "Instruction — Relvo" };

// Lecture/édition d'une instruction (M9.20) dans une page dédiée — titre + corps
// en entier, interrupteur d'activation, suppression.
export default async function InstructionPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const db = await getTenantDb();
  const note = await db.knowledgeDocument.findFirst({
    where: { id: noteId, folderId: id, kind: "note" },
    select: { id: true, name: true, content: true, absorptionStatus: true },
  });
  if (!note) notFound();

  return (
    <Screen>
      <RelvoHeader
        back={`/dossiers/${id}`}
        title="Instruction"
        subtitle="Consigne appliquée par Relvo"
        className="pb-9"
      />
      <NoteForm
        folderId={id}
        note={{
          id: note.id,
          name: note.name,
          content: note.content,
          active: note.absorptionStatus === "read",
        }}
      />
    </Screen>
  );
}
