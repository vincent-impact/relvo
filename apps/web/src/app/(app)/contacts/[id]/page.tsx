import { notFound } from "next/navigation";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ContactCard } from "@/components/contacts/contact-card";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import { SectionLabel } from "@/components/shared/section-label";
import { formatRelative } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Contact (M9.11, Direction B) — coordonnées éditables (auto → complete)
// + fil des échanges, tous canaux confondus (invariant n°11).

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
};

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const contact = await db.contact.findFirst({ where: { id } });
  if (!contact) notFound();

  const messages = await db.message.findMany({
    where: {
      OR: [{ senderContactId: id }, { recipientContactId: id }],
    },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: { channel: { select: { type: true } } },
  });

  const bubbles: MessageBubbleData[] = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    actor: m.direction === "outgoing" ? "user" : "contact",
    senderName: m.direction === "outgoing" ? "Moi" : contact.name,
    channel: CHANNEL_LABEL[m.channel.type] ?? null,
    time: formatRelative(m.receivedAt ?? m.sentAt ?? m.createdAt),
    content: m.content ?? "",
  }));

  return (
    <Screen>
      <RelvoHeader
        back="/contacts"
        title={contact.name}
        subtitle={
          [contact.jobTitle, contact.company].filter(Boolean).join(" · ") ||
          "Contact"
        }
        className="pb-9"
      />

      <ContactCard contact={contact} />

      <SectionLabel title="Échanges" dotColor="var(--amber-600)" />
      {bubbles.length === 0 ? (
        <p className="px-[22px] py-6 text-center text-[13.5px] text-(--text-tertiary)">
          Aucun échange enregistré.
        </p>
      ) : (
        <div className="flex flex-col gap-[15px] px-[18px] pt-2">
          {bubbles.map((b) => (
            <MessageBubble key={b.id} data={b} />
          ))}
        </div>
      )}
    </Screen>
  );
}
