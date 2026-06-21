import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import type { Actor } from "@relvo/db";
import { getSubjectDetail } from "@relvo/db";
import { AppBar, PageBody } from "@/components/layout/app-bar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { ActorPill } from "@/components/shared/actor-pill";
import {
  StatusBadge,
  TodoBadge,
  UrgentFlag,
  WaitingBadge,
} from "@/components/shared/badges";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import { TaskCard } from "@/components/shared/task-card";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { RelvoSummary } from "@/components/subject/relvo-summary";
import { SubjectActionBar } from "@/components/subject/subject-action-bar";
import { SubjectReplyComposer } from "@/components/subject/subject-reply-composer";
import { TaskCheckbox } from "@/components/subject/task-checkbox";
import { folderColor, formatRelative, formatTaskDate } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Sujet (M9.5) — header + résumé Relvo + onglets (Messages / Tâches /
// Journal / Pièces jointes) + composer multi-canal + barre d'actions fixe.
// Hors du groupe (app) : chrome propre (pas de composer Relvo persistant).

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

export default async function SujetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();
  const detail = await getSubjectDetail(db, id);
  if (!detail) notFound();

  const { subject, contacts, messages, tasks, events, attachments, draft } =
    detail;
  const mainContact = contacts[0];
  const openTaskCount = tasks.filter((t) => t.status === "open").length;
  const channelLabel =
    CHANNEL_LABEL[messages.at(-1)?.channel.type ?? ""] ?? "Message";
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
    content: m.content ?? "",
    attachment: m.attachments[0]
      ? { name: m.attachments[0].name, label: m.attachments[0].aiLabel }
      : null,
  }));

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />
      <AppBar
        back="/fil"
        leading={
          mainContact ? (
            <span className="grid size-[34px] flex-none place-items-center rounded-full bg-(--surface-2) text-[13px] font-bold text-(--text-secondary)">
              {initials(mainContact.name)}
            </span>
          ) : undefined
        }
        title={<span className="text-[16px]">{subject.title}</span>}
        subtitle={
          mainContact
            ? [mainContact.name, mainContact.company]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        action={
          <Link
            href={`/conversation?from=/sujets/${subject.id}`}
            aria-label="Demander à Relvo"
            className="grid size-[38px] flex-none place-items-center rounded-full bg-relvo-bg text-relvo"
          >
            <Sparkles className="size-[21px]" />
          </Link>
        }
      />

      <PageBody className="pt-3 pb-4">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="rounded-full bg-(--surface-2) px-2.5 py-1 text-[11.5px] font-semibold text-(--text-secondary)">
            {subject.reference}
          </span>
          {subject.priority === "critical" ? <UrgentFlag /> : null}
          <StatusBadge status={subject.status} />
          {openTaskCount > 0 ? <TodoBadge /> : null}
          {subject.waitingForReply ? <WaitingBadge /> : null}
          {subject.folder ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-(--text-secondary) shadow-(--shadow-card)">
              <span
                className="size-2 rounded-full"
                style={{ background: folderColor(subject.folder.slug) }}
              />
              {subject.folder.name}
            </span>
          ) : null}
        </div>

        {subject.summary ? <RelvoSummary text={subject.summary} /> : null}

        <div className="mt-3.5">
          <FeedTabs
            options={[
              { value: "messages", label: "Messages" },
              { value: "taches", label: "Tâches" },
              { value: "journal", label: "Journal" },
              { value: "pj", label: "Pièces jointes" },
            ]}
            panes={{
              messages: (
                <div>
                  <div className="flex flex-col gap-3">
                    {bubbles.length === 0 ? (
                      <p className="text-[13.5px] text-(--text-tertiary)">
                        Aucun message.
                      </p>
                    ) : (
                      bubbles.map((b) => <MessageBubble key={b.id} data={b} />)
                    )}
                  </div>
                  <SubjectReplyComposer
                    channelLabel={channelLabel}
                    recipientName={mainContact?.name ?? "le contact"}
                    draft={draftContent}
                  />
                </div>
              ),
              taches: (
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-[13.5px] text-(--text-tertiary)">
                      Aucune tâche.
                    </p>
                  ) : (
                    tasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        data={{
                          id: t.id,
                          title: t.title,
                          status: t.status,
                          sourceActor: t.sourceActor,
                          dateLabel: formatTaskDate(t.startDate, t.startTime),
                        }}
                        checkbox={
                          <TaskCheckbox
                            taskId={t.id}
                            done={t.status === "done"}
                          />
                        }
                      />
                    ))
                  )}
                  <button
                    type="button"
                    className="w-full rounded-lg border border-dashed border-(--border) px-3 py-2.5 text-[13.5px] font-semibold text-(--text-secondary)"
                  >
                    <Plus className="mr-1 inline size-4 align-text-bottom" />
                    Ajouter une tâche
                  </button>
                </div>
              ),
              journal: (
                <div>
                  {events.length === 0 ? (
                    <p className="text-[13.5px] text-(--text-tertiary)">
                      Journal vide.
                    </p>
                  ) : (
                    events.map((ev, i) => (
                      <div key={ev.id} className="relative flex gap-3 pb-4">
                        <span
                          className={`mt-1 size-[11px] flex-none rounded-full border-2 border-(--surface) ${ACTOR_DOT[ev.actor]}`}
                        />
                        {i < events.length - 1 ? (
                          <span className="absolute top-4 left-[5px] h-full w-0.5 bg-(--border)" />
                        ) : null}
                        <div className="flex-1">
                          <div className="text-[13.5px]">{ev.title}</div>
                          <div className="mt-0.5 text-[11.5px] text-(--text-tertiary)">
                            {formatRelative(ev.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ),
              pj: (
                <div className="space-y-2">
                  {attachments.length === 0 ? (
                    <p className="text-[13.5px] text-(--text-tertiary)">
                      Aucune pièce jointe.
                    </p>
                  ) : (
                    attachments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border border-(--border-light) bg-white px-3 py-2.5 shadow-(--shadow-card)"
                      >
                        <span className="grid size-[34px] flex-none place-items-center rounded-md bg-(--surface-2) text-(--text-secondary)">
                          📄
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
                          <span className="rounded-full bg-(--amber-50) px-2 py-px text-[11px] text-(--amber-800)">
                            {a.aiLabel}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ),
            }}
          />
        </div>
      </PageBody>

      <SubjectActionBar
        subjectId={subject.id}
        canIgnore={subject.priority !== "low"}
      />
      <BottomTabBar />
    </MobileFrame>
  );
}
