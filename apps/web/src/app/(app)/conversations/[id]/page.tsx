import { notFound } from "next/navigation";
import { getConversationThread } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import { MarkConversationRead } from "@/components/conversations/mark-conversation-read";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { toThreadMessageData } from "@/lib/conversation-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'une conversation (M6ter) — timeline chronologique + BANDEAU « Suivi
// dans ». Le cordon a disparu (écoute binaire). Ouvrir la page vaut LECTURE de
// ses messages entrants (MarkConversationRead).
//
// Le retour pointe sur le filtre d'où l'on vient (`?filtre=…`) : arriver de
// « Ignorées » et repartir sur « Sans sujet » perdrait le fil du tri en cours.

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

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
  const unsorted = messages.filter((m) => !m.subject).length;

  return (
    <Screen>
      <MarkConversationRead conversationId={id} />
      <RelvoHeader
        back={backTo}
        title={thread.title}
        subtitle={`${CHANNEL_LABEL[thread.channelType] ?? "Canal"} · ${
          messages.length
        } message${messages.length > 1 ? "s" : ""}${
          unsorted > 0 ? ` · ${unsorted} sans sujet` : ""
        }`}
        className="pb-8"
      />

      <ConversationThread
        messages={messages}
        channelType={thread.channelType}
        listenings={thread.listenings}
        backTo={backTo}
      />
    </Screen>
  );
}
