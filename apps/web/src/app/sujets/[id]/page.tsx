import { notFound } from "next/navigation";
import { ChevronDown, FileText, History, Paperclip } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Actor } from "@relvo/db";
import { getSubjectDetail } from "@relvo/db";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { ActorPill } from "@/components/shared/actor-pill";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import {
  RecipientComposer,
  type Recipient,
} from "@/components/shared/recipient-composer";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { AddTask } from "@/components/subject/add-task";
import { SwipeTaskDelete } from "@/components/subject/swipe-task-delete";
import { RelvoDraftBlock } from "@/components/subject/relvo-draft-block";
import { RelvoSummary } from "@/components/subject/relvo-summary";
import { SlideToComplete } from "@/components/subject/slide-to-complete";
import {
  SubjectDangerZone,
  SubjectDetailForm,
} from "@/components/subject/subject-detail-form";
import { TaskCheckbox } from "@/components/subject/task-checkbox";
import { cn } from "@/lib/utils";
import { folderVisual } from "@/lib/folders";
import { formatRelative, formatTaskDate } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Sujet (M9.5, Direction B) — hero violet portant le status-strip + le
// résumé Relvo, + Ignorer/Terminer en haut à droite (contexte de page). Onglets
// Messages / Tâches / Détail (le Détail paramètre les propriétés du sujet et
// porte PJ + Journal). Bas = RecipientComposer (contact ↔ Relvo). Pas de tab bar.

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
};

const ACTOR_DOT: Record<Actor, string> = {
  user: "bg-brand",
  ai: "bg-relvo",
  contact: "bg-(--amber-600)",
  system: "bg-(--text-tertiary)",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Tag translucide blanc posé dans la zone agent violette (status-strip). */
function HeroTag({
  children,
  tone = "glass",
}: {
  children: React.ReactNode;
  tone?: "glass" | "urgent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[10.5px] font-bold",
        tone === "urgent"
          ? "bg-(--red-600) text-white"
          : "bg-white/18 text-white",
      )}
    >
      {children}
    </span>
  );
}

/** Section repliable autonome (PJ, Journal) — titre lisible, contenu contenu. */
function DetailSection({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <details className="group mx-4 mt-3 overflow-hidden rounded-2xl border border-(--border-light) bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <Icon
            className="size-[18px] flex-none text-(--text-tertiary)"
            strokeWidth={2}
          />
          <span className="text-[16px] font-bold">{title}</span>
          <span className="text-[13px] font-semibold text-(--text-tertiary)">
            {count}
          </span>
        </span>
        <ChevronDown
          className="size-5 flex-none text-(--text-tertiary) transition-transform group-open:rotate-180"
          strokeWidth={2.2}
        />
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

export default async function SujetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const db = await getTenantDb();
  // folders + allContacts ne dépendent pas du sujet → on les charge dans la même
  // vague que getSubjectDetail (une seule attente DB au lieu de deux successives).
  const [detail, folders, allContacts] = await Promise.all([
    getSubjectDetail(db, id),
    db.folder.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    db.contact.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true },
    }),
  ]);
  if (!detail) notFound();

  const { subject, contacts, messages, tasks, events, attachments, draft } =
    detail;

  const mainContact = contacts[0];
  const openTaskCount = tasks.filter((t) => t.status === "open").length;
  const draftContent =
    draft && typeof draft.payload === "object" && draft.payload
      ? ((draft.payload as { content?: string }).content ?? null)
      : null;

  const bubbles: MessageBubbleData[] = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    actor: m.direction === "outgoing" ? "user" : "contact",
    senderName: m.senderContact?.name ?? m.senderRaw,
    channel: CHANNEL_LABEL[m.channel.type] ?? null,
    time: formatRelative(m.receivedAt ?? m.sentAt ?? m.createdAt),
    content: m.content ?? "",
    attachment: m.attachments[0]
      ? { name: m.attachments[0].name, label: m.attachments[0].aiLabel }
      : null,
    href: `/messages/${m.id}`,
  }));

  const recipients: Recipient[] = [];
  if (mainContact) {
    const channel = CHANNEL_LABEL[messages.at(-1)?.channel.type ?? ""] ?? null;
    recipients.push({
      key: "contact",
      name: mainContact.name,
      kind: "human",
      initials: initials(mainContact.name),
      sublabel: [mainContact.company, channel].filter(Boolean).join(" · "),
    });
  }
  recipients.push({
    key: "relvo",
    name: "Relvo",
    kind: "relvo",
    sublabel: "Votre assistant",
  });

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />

      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        <RelvoHeader
          back="/fil"
          title={subject.title}
          subtitle={
            mainContact
              ? `${subject.reference} · ${[mainContact.name, mainContact.company].filter(Boolean).join(" — ")}`
              : subject.reference
          }
          className="pb-10"
          action={<SlideToComplete subjectId={subject.id} />}
        >
          <div className="px-[22px]">
            <div className="my-3 flex flex-wrap items-center gap-[7px]">
              {subject.priority === "urgent" ? (
                <HeroTag tone="urgent">Urgent</HeroTag>
              ) : null}
              {subject.status === "new" ? <HeroTag>Nouveau</HeroTag> : null}
              {openTaskCount > 0 ? (
                <HeroTag>À faire · {openTaskCount}</HeroTag>
              ) : null}
              {subject.waitingForReply ? <HeroTag>En attente</HeroTag> : null}
              {subject.folder
                ? (() => {
                    const { icon: FolderIcon } = folderVisual(
                      subject.folder.slug,
                    );
                    return (
                      <HeroTag>
                        <FolderIcon className="size-3" strokeWidth={2.2} />
                        {subject.folder.name}
                      </HeroTag>
                    );
                  })()
                : null}
            </div>
            {subject.summary ? (
              <RelvoSummary text={subject.summary} tone="hero" />
            ) : null}
          </div>
        </RelvoHeader>

        <FeedTabs
          defaultValue={
            ["messages", "taches", "detail"].includes(tab ?? "")
              ? tab
              : undefined
          }
          options={[
            { value: "messages", label: "Messages" },
            { value: "taches", label: "Tâches", count: tasks.length },
            { value: "detail", label: "Détails" },
          ]}
          panes={{
            messages: (
              <div className="flex flex-col gap-[15px] px-[18px] pt-4 pb-3">
                {bubbles.length === 0 ? (
                  <p className="text-[13.5px] text-(--text-tertiary)">
                    Aucun message.
                  </p>
                ) : (
                  bubbles.map((b) => <MessageBubble key={b.id} data={b} />)
                )}
                {draftContent ? <RelvoDraftBlock text={draftContent} /> : null}
              </div>
            ),
            taches: (
              <div className="pt-3 pb-2">
                {tasks.length === 0 ? (
                  <p className="px-[22px] text-[13.5px] text-(--text-tertiary)">
                    Aucune tâche.
                  </p>
                ) : (
                  tasks.map((t) => {
                    const done = t.status === "done";
                    return (
                      <SwipeTaskDelete key={t.id} taskId={t.id}>
                        <div className="mx-[14px] flex items-start gap-3 border-b border-[#f1efeb] px-[18px] py-[13px]">
                          <TaskCheckbox taskId={t.id} done={done} />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "text-[14.5px] font-semibold",
                                done && "text-[#a8a69d] line-through",
                              )}
                            >
                              {t.title}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <ActorPill actor={t.sourceActor} />
                              {formatTaskDate(t.startDate, t.startTime) ? (
                                <span className="text-[11.5px] text-[#a8a69d]">
                                  {formatTaskDate(t.startDate, t.startTime)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </SwipeTaskDelete>
                    );
                  })
                )}
                <AddTask subjectId={subject.id} />
              </div>
            ),
            detail: (
              <div className="pb-2">
                <SubjectDetailForm
                  mode="edit"
                  subjectId={subject.id}
                  folders={folders}
                  contacts={allContacts}
                  initial={{
                    title: subject.title,
                    status: subject.status,
                    priority: subject.priority,
                    folderId: subject.folderId,
                    contactIds: subject.contactIds,
                  }}
                />

                <div className="mx-4 mt-5 border-t border-(--border-light)" />

                <DetailSection
                  title="Pièces jointes"
                  count={attachments.length}
                  icon={Paperclip}
                >
                  {attachments.length === 0 ? (
                    <p className="pb-1 text-[13.5px] text-(--text-tertiary)">
                      Aucune pièce jointe.
                    </p>
                  ) : (
                    <div className="space-y-2 pb-1">
                      {attachments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 rounded-xl border border-[#ececea] bg-white px-3 py-2.5 shadow-(--shadow-card)"
                        >
                          <span className="grid size-[34px] flex-none place-items-center rounded-lg bg-[#f0eeea] text-[#86857d]">
                            <FileText className="size-[18px]" strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-semibold">
                              {a.name}
                            </div>
                            <div className="text-[11.5px] text-(--text-tertiary)">
                              {formatRelative(a.createdAt)}
                            </div>
                          </div>
                          {a.aiLabel ? (
                            <span className="flex-none rounded-full bg-(--surface-2) px-2 py-px text-[11px] font-semibold text-(--text-secondary)">
                              {a.aiLabel}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>

                <DetailSection
                  title="Journal"
                  count={events.length}
                  icon={History}
                >
                  {events.length === 0 ? (
                    <p className="pb-1 text-[13.5px] text-(--text-tertiary)">
                      Journal vide.
                    </p>
                  ) : (
                    <div className="pt-1 pb-1">
                      {events.map((ev, i) => (
                        <div
                          key={ev.id}
                          className="relative flex gap-[13px] pb-[17px]"
                        >
                          <span
                            className={cn(
                              "z-[1] mt-[3px] size-[11px] flex-none rounded-full border-2 border-white",
                              ACTOR_DOT[ev.actor],
                            )}
                          />
                          {i < events.length - 1 ? (
                            <span className="absolute top-[13px] -bottom-1 left-[5px] w-0.5 bg-[#ece9e3]" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] leading-[1.4] text-[#3a3833]">
                              {ev.title}
                            </div>
                            <div className="mt-[3px] text-[11.5px] text-[#a8a69d]">
                              {formatRelative(ev.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>

                <SubjectDangerZone subjectId={subject.id} />
              </div>
            ),
          }}
        />
      </main>

      <RecipientComposer
        recipients={recipients}
        defaultRecipient={mainContact ? "contact" : "relvo"}
      />
    </MobileFrame>
  );
}
