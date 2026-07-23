import { notFound } from "next/navigation";
import { getConversationThread } from "@relvo/db";
import { ConversationDetail } from "@/components/conversations/conversation-detail";
import { MarkConversationRead } from "@/components/conversations/mark-conversation-read";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { toThreadMessageData } from "@/lib/conversation-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'une conversation (M6ter, header enrichi 2026-07-23) — le HEADER
// violet ne porte plus que la flèche retour + le titre (objet) sur 2 lignes ;
// tout le contexte (interlocuteur, canal, domaine, résumé, sujets, menu) vit
// dans la carte enrichie de `ConversationDetail`, juste en dessous. Ouvrir la
// page vaut LECTURE de ses messages entrants (MarkConversationRead).
//
// Le retour pointe sur le filtre d'où l'on vient (`?filtre=…`).

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

  const messages = thread.messages.map(toThreadMessageData);
  const backTo = `/conversations?filtre=${filtre ?? "sans-sujet"}`;
  const isGroup = thread.type === "whatsapp_group";

  return (
    <Screen>
      <MarkConversationRead conversationId={id} />
      <RelvoHeader
        back={backTo}
        title={thread.title}
        wrapTitle
        relvo={false}
        subtitle={`${messages.length} message${messages.length > 1 ? "s" : ""}`}
        className="pb-6"
      />

      <ConversationDetail
        conversationId={id}
        channelType={thread.channelType}
        channelName={thread.channelName}
        interlocutorName={thread.interlocutorName}
        isGroup={isGroup}
        listenings={thread.listenings}
        messages={messages}
        backTo={backTo}
      />
    </Screen>
  );
}
