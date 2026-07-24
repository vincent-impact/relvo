import { notFound } from "next/navigation";
import { getConversationThread } from "@relvo/db";
import { ConversationDetail } from "@/components/conversations/conversation-detail";
import { MarkConversationRead } from "@/components/conversations/mark-conversation-read";
import { toThreadMessageData } from "@/lib/conversation-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'une conversation (M6ter, header enrichi 2026-07-23 v2) — TOUT le
// contexte (interlocuteur, canal, domaine, résumé, sujets) vit dans le hero
// violet, et deux boutons d'action « Ignorer » / « Ouvrir un sujet » remplacent
// le dock en bas. Le corps (hero + fil + barre d'action) est rendu par le
// composant client `ConversationDetail`, qui possède son propre <Screen>.
// Ouvrir la page vaut LECTURE de ses messages entrants (MarkConversationRead).

export default async function ConversationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { id } = await params;
  const { filtre } = await searchParams;

  const db = await getTenantDb();
  const thread = await getConversationThread(db, id).catch(() => null);
  if (!thread) notFound();

  // Domaines (dialog de création) + sujets ouverts (« Lier à un sujet existant »).
  const [folders, subjectRows] = await Promise.all([
    db.folder.findMany({
      where: { isDefault: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true, icon: true },
    }),
    db.subject.findMany({
      where: { status: "open" },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        reference: true,
        title: true,
        folder: { select: { slug: true } },
      },
    }),
  ]);

  const messages = thread.messages.map(toThreadMessageData);
  const backTo = `/conversations?filtre=${filtre ?? "sans-sujet"}`;
  const isGroup = thread.type === "whatsapp_group";

  return (
    <>
      <MarkConversationRead conversationId={id} />
      <ConversationDetail
        conversationId={id}
        title={thread.title}
        channelType={thread.channelType}
        isGroup={isGroup}
        participants={thread.participants}
        listenings={thread.listenings}
        messages={messages}
        backTo={backTo}
        folders={folders}
        subjects={subjectRows.map((s) => ({
          id: s.id,
          reference: s.reference,
          title: s.title,
          folderSlug: s.folder?.slug ?? null,
        }))}
      />
    </>
  );
}
