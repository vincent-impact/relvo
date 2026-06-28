import { notFound } from "next/navigation";
import {
  ChevronDown,
  FileText,
  History,
  Paperclip,
  SquareCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Actor } from "@relvo/db";
import { getSubjectDetail } from "@relvo/db";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
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
import { RelvoDraftBlock } from "@/components/subject/relvo-draft-block";
import { RelvoSummary } from "@/components/subject/relvo-summary";
import {
  SubjectDangerZone,
  SubjectDetailForm,
} from "@/components/subject/subject-detail-form";
import { TaskItem } from "@/components/subject/task-item";
import { cn } from "@/lib/utils";
import { contactFullName, formatRelative } from "@/lib/display";
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
  searchParams: Promise<{ tab?: string; from?: string }>;
}) {
  const { id } = await params;
  const { tab, from } = await searchParams;
  // `from` = page d'origine (ex. l'écran Actions via une tâche). Sanitisé pour
  // rester un chemin interne ; sinon retour par défaut au fil des Sujets.
  const backHref =
    from && from.startsWith("/") && !from.startsWith("//") ? from : "/fil";
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, company: true },
    }),
  ]);
  if (!detail) notFound();

  const { subject, contacts, messages, tasks, events, attachments, draft } =
    detail;
  const allContactOptions = allContacts.map((c) => ({
    id: c.id,
    name: contactFullName(c),
    company: c.company,
  }));

  const mainContact = contacts[0];
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
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

  // Destinataires = les contacts du sujet (un sujet peut en porter plusieurs →
  // le select reste utile). Relvo n'est PLUS un destinataire ici : il s'atteint
  // via le bouton Relvo du header (décision 2026-06-27). Le canal n'est connu que
  // pour le dernier interlocuteur — on l'affiche sur le 1er contact.
  const lastChannel =
    CHANNEL_LABEL[messages.at(-1)?.channel.type ?? ""] ?? null;
  const recipients: Recipient[] = contacts.map((c, i) => ({
    key: `contact-${c.id}`,
    name: c.name,
    kind: "human",
    initials: initials(c.name),
    sublabel:
      [c.company, i === 0 ? lastChannel : null].filter(Boolean).join(" · ") ||
      undefined,
  }));

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />

      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        <RelvoHeader
          back={backHref}
          title={subject.title}
          subtitle={
            mainContact
              ? `${subject.reference} · ${[mainContact.name, mainContact.company].filter(Boolean).join(" — ")}`
              : subject.reference
          }
          className="pb-10"
        >
          <div className="px-[22px] pt-3.5">
            {subject.summary ? (
              <RelvoSummary text={subject.summary} tone="hero" />
            ) : null}
            {/* Progress bar récapitulative de l'avancement des tâches (rappel du
                fil) — posée sous le résumé Relvo, dans le hero violet. */}
            {taskTotal > 0 ? (
              <div className="mt-3.5 flex items-center gap-2.5">
                <SquareCheck
                  className="size-[17px] flex-none text-white/85"
                  strokeWidth={2.2}
                />
                <span className="relative block h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width]"
                    style={{ width: `${taskPct}%` }}
                  />
                </span>
                <span className="font-numeric text-[12px] font-bold text-white/90 tabular-nums">
                  {taskDone}/{taskTotal}
                </span>
              </div>
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
            { value: "taches", label: "Tâches", count: tasks.length },
            { value: "messages", label: "Messages" },
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
                  tasks.map((t) => (
                    <TaskItem
                      key={t.id}
                      meta="date"
                      task={{
                        id: t.id,
                        title: t.title,
                        startDate: t.startDate
                          ? t.startDate.toISOString().slice(0, 10)
                          : null,
                        startTime: t.startTime
                          ? t.startTime.toISOString().slice(11, 16)
                          : null,
                        status: t.status,
                        sourceActor: t.sourceActor,
                        subjectId: subject.id,
                        subjectTitle: subject.title,
                        folderSlug:
                          folders.find((f) => f.id === subject.folderId)
                            ?.slug ?? null,
                      }}
                    />
                  ))
                )}
                <AddTask
                  subjectId={subject.id}
                  subjectTitle={subject.title}
                  subjectFolderSlug={
                    folders.find((f) => f.id === subject.folderId)?.slug ?? null
                  }
                />
              </div>
            ),
            detail: (
              <div className="pb-2">
                <SubjectDetailForm
                  mode="edit"
                  subjectId={subject.id}
                  folders={folders}
                  contacts={allContactOptions}
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

      {recipients.length > 0 ? (
        <RecipientComposer
          recipients={recipients}
          defaultRecipient={recipients[0]?.key}
        />
      ) : null}
    </MobileFrame>
  );
}
