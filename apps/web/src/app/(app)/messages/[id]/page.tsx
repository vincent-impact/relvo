import { notFound } from "next/navigation";
import { getMessageEvent } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MarkReadOnOpen } from "@/components/messages/mark-read-on-open";
import { MessageDetailView } from "@/components/messages/message-detail-view";
import { toMessageRowData } from "@/lib/message-row";
import { getTenantDb } from "@/server/auth-context";

// Détail d'un message reçu (page, pas une modale). Ouvrir la page = lecture
// (MarkReadOnOpen). Sujets candidats fournis pour l'action « Rattacher ».

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const [item, subjectRows] = await Promise.all([
    getMessageEvent(db, id),
    db.subject.findMany({
      where: { status: { not: "archived" } },
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
  if (!item) notFound();

  const data = toMessageRowData(item);
  const subjects = subjectRows.map((s) => ({
    id: s.id,
    reference: s.reference,
    title: s.title,
    folderSlug: s.folder?.slug ?? null,
  }));

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
      <MessageDetailView data={data} subjects={subjects} />
    </Screen>
  );
}
