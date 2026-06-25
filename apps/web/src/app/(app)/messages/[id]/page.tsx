import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMessageEvent } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MarkReadOnOpen } from "@/components/messages/mark-read-on-open";
import { MessageDetailView } from "@/components/messages/message-detail-view";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { type MessageRowData, toMessageRowData } from "@/lib/message-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'un message reçu (page, pas une modale). Ouvrir la page = lecture
// (MarkReadOnOpen). Sujets candidats fournis pour l'action « Rattacher ».
//
// PERF (M9.19, point 2) : le hero + le message s'affichent dès que getMessageEvent
// répond ; la liste des sujets candidats (jusqu'à 200) stream dans un <Suspense>.

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

async function MessageBody({ data }: { data: MessageRowData }) {
  const db = await getTenantDb();
  const subjectRows = await db.subject.findMany({
    where: { status: { not: "archived" } },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      reference: true,
      title: true,
      folder: { select: { slug: true } },
    },
  });
  const subjects = subjectRows.map((s) => ({
    id: s.id,
    reference: s.reference,
    title: s.title,
    folderSlug: s.folder?.slug ?? null,
  }));
  return <MessageDetailView data={data} subjects={subjects} />;
}

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const item = await getMessageEvent(db, id);
  if (!item) notFound();

  const data = toMessageRowData(item);

  // Retour contextuel : un message classé revient à SON sujet (on y est arrivé
  // par une bulle du fil) ; un orphelin revient à la pile « Messages sans sujet ».
  const back = data.subject ? `/sujets/${data.subject.id}` : "/messages";

  return (
    <Screen>
      <MarkReadOnOpen messageId={id} />
      <RelvoHeader
        back={back}
        title="Message"
        subtitle={`${CHANNEL_LABEL[data.channelType] ?? "Canal"} · ${data.time}`}
        className="pb-8"
      />
      <Suspense fallback={<RowsSkeleton count={3} />}>
        <MessageBody data={data} />
      </Suspense>
    </Screen>
  );
}
