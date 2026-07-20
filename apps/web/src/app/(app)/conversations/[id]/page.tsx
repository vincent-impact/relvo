import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getConversationThread } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import { MarkConversationRead } from "@/components/conversations/mark-conversation-read";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import {
  type ThreadMessageData,
  toThreadMessageData,
} from "@/lib/conversation-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'une conversation (M6bis.9) — timeline chronologique + cordon de sujet.
// Ouvrir la page vaut LECTURE de ses messages entrants (MarkConversationRead).
//
// Le retour pointe sur le filtre d'où l'on vient (`?filtre=…`) : arriver de
// « Ignorées » et repartir sur « Sans sujet » perdrait le fil du tri en cours.
//
// PERF (M9.19) : hero + fil dès que la conversation répond ; la liste des sujets
// candidats (jusqu'à 200) stream dans un <Suspense>.

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

async function ThreadBody({
  messages,
  backTo,
}: {
  messages: ThreadMessageData[];
  backTo: string;
}) {
  const db = await getTenantDb();
  const subjectRows = await db.subject.findMany({
    // On ne rattache pas un message à une fenêtre déjà refermée : un sujet
    // `validated` ou `closed` n'est plus un candidat.
    where: { status: { notIn: ["validated", "closed"] } },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      reference: true,
      title: true,
      folder: { select: { slug: true } },
    },
  });

  return (
    <ConversationThread
      messages={messages}
      subjects={subjectRows.map((s) => ({
        id: s.id,
        reference: s.reference,
        title: s.title,
        folderSlug: s.folder?.slug ?? null,
      }))}
      backTo={backTo}
    />
  );
}

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

      <Suspense fallback={<RowsSkeleton count={3} />}>
        <ThreadBody messages={messages} backTo={backTo} />
      </Suspense>
    </Screen>
  );
}
