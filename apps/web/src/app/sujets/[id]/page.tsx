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
import {
  getSubjectDetail,
  listChannels,
  listConversationGroups,
  listSubjectConversations,
} from "@relvo/db";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { type MessageBubbleData } from "@/components/shared/message-bubble";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { AddTask } from "@/components/subject/add-task";
import { RelvoDraftBlock } from "@/components/subject/relvo-draft-block";
import { InformationsPane } from "@/components/subject/informations-pane";
import {
  SubjectBody,
  type ReplyTarget,
  type SubjectConversationPane,
} from "@/components/subject/subject-body";
import { SubjectTitleInline } from "@/components/subject/subject-title-inline";
import {
  SubjectDangerZone,
  SubjectDetailForm,
} from "@/components/subject/subject-detail-form";
import { TaskItem } from "@/components/subject/task-item";
import { cn } from "@/lib/utils";
import { contactFullName, formatRelative } from "@/lib/display";
import { folderVisual } from "@/lib/folders";
import { getTenantDb } from "@/server/auth-context";

// Fiche Sujet (M9.5, Direction B) — hero violet portant le status-strip + le
// résumé Relvo, + Fermer/Valider en haut à droite (contexte de page). Onglets
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
  const [detail, folders, allContacts, subjectConversations, channels, groups] =
    await Promise.all([
      getSubjectDetail(db, id),
      db.folder.findMany({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        // color/icon : le logo du domaine alimente la pastille de la pop-up
        // « tap sur un message » (folderVisual), pas seulement le slug du seed.
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          icon: true,
        },
      }),
      db.contact.findMany({
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          email: true,
          phone: true,
        },
      }),
      // Conversations portées par le sujet (M6bis) — elles donnent les CIBLES
      // D'ENVOI, y compris pour un interlocuteur qui n'a encore rien écrit (cas
      // S : on vient tout juste d'étendre le sujet à son adresse email).
      listSubjectConversations(db, id),
      // Canaux connectés (email/WhatsApp) + groupes existants → dialog « Ajouter
      // une conversation » (item 4).
      listChannels(db),
      listConversationGroups(db),
    ]);
  if (!detail) notFound();

  // Canaux CONNECTÉS uniquement (on ne propose pas d'écrire par un canal en
  // attente/erreur). Dédupliqués par type.
  const availableChannels = [
    ...new Set(
      channels
        .filter((c) => c.config?.status === "connected")
        .map((c) => c.type),
    ),
  ].filter((t): t is "email" | "whatsapp" => t === "email" || t === "whatsapp");

  const { subject, messages, tasks, events, attachments, draft } = detail;
  const allContactOptions = allContacts.map((c) => ({
    id: c.id,
    name: contactFullName(c),
    company: c.company,
  }));
  // Contacts joignables pour le dialog « Ajouter une conversation » (avec leur
  // email/numéro : le dialog filtre selon le canal choisi).
  const addContacts = allContacts.map((c) => ({
    id: c.id,
    name: contactFullName(c),
    email: c.email,
    phone: c.phone,
  }));

  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const draftContent =
    draft && typeof draft.payload === "object" && draft.payload
      ? ((draft.payload as { content?: string }).content ?? null)
      : null;

  // Domaine du sujet (affiché dans le hero) — le Folder rattaché, ou « Non
  // classé » tant qu'aucun domaine n'est assigné. Icône + couleur du domaine.
  const subjectFolder = folders.find((f) => f.id === subject.folderId) ?? null;
  const folderViz = folderVisual(
    subjectFolder
      ? {
          slug: subjectFolder.slug,
          color: subjectFolder.color,
          icon: subjectFolder.icon,
        }
      : "general",
  );
  const FolderIcon = folderViz.icon;
  const domainName = subjectFolder?.name ?? "Non classé";

  const contactNameById = new Map(
    allContacts.map((c) => [c.id, contactFullName(c)]),
  );

  function toBubble(m: (typeof messages)[number]): MessageBubbleData {
    return {
      id: m.id,
      direction: m.direction,
      actor: m.direction === "outgoing" ? "user" : "contact",
      senderName: m.senderContact?.name ?? m.senderName ?? m.senderRaw,
      channel: CHANNEL_LABEL[m.channel.type] ?? null,
      channelType: m.channel.type,
      time: formatRelative(m.receivedAt ?? m.sentAt ?? m.createdAt),
      content: m.content ?? "",
      contentHtml: m.contentHtml,
      attachment: m.attachments[0]
        ? {
            id: m.attachments[0].id,
            name: m.attachments[0].name,
            label: m.attachments[0].aiLabel,
            mimeType: m.attachments[0].mimeType,
          }
        : null,
    };
  }

  // UN ONGLET PAR CONVERSATION (2026-07-23) — les messages ne se MÉLANGENT jamais
  // entre deux conversations d'un même sujet. Chaque conversation porte SES
  // messages (filtrés par `conversationId`), son état d'écoute (Pause/Play) et sa
  // cible d'envoi (canal + interlocuteur + fil).
  const conversationPanes: SubjectConversationPane[] = subjectConversations.map(
    (c) => {
      const convMessages = messages.filter(
        (m) => m.conversationId === c.conversationId,
      );
      const isGroup = c.type === "whatsapp_group";
      const contactName = c.contactId
        ? (contactNameById.get(c.contactId) ?? null)
        : null;
      const title = isGroup
        ? c.title || "Groupe"
        : (contactName ?? c.interlocutorRaw ?? "Interlocuteur");
      const state: "active" | "paused" | "ended" =
        c.status === "ignored"
          ? "paused"
          : c.closingMessageId != null
            ? "ended"
            : "active";
      const unreadCount = convMessages.filter(
        (m) => m.direction === "incoming" && m.readAt == null,
      ).length;
      const reply: ReplyTarget =
        c.channelType === "email" && c.interlocutorRaw
          ? {
              kind: "email",
              channelId: c.channelId,
              email: c.interlocutorRaw,
              contactId: c.contactId,
            }
          : c.channelType === "whatsapp" && c.externalThreadId
            ? {
                kind: "whatsapp",
                channelId: c.channelId,
                chatId: c.externalThreadId,
                contactId: c.contactId,
              }
            : { kind: "none" };
      return {
        conversationId: c.conversationId,
        channelType: c.channelType,
        title,
        isGroup,
        unreadCount,
        state,
        messages: convMessages.map(toBubble),
        reply,
      };
    },
  );

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />
      <PollRefresh />

      <SubjectBody
        defaultTab={
          (["informations", "messages", "taches", "detail"] as const).includes(
            (tab ?? "") as "informations" | "messages" | "taches" | "detail",
          )
            ? (tab as "informations" | "messages" | "taches" | "detail")
            : "informations"
        }
        tasksCount={tasks.length}
        draft={draftContent ? <RelvoDraftBlock text={draftContent} /> : null}
        informationsPane={
          <InformationsPane
            subjectId={subject.id}
            description={subject.description}
          />
        }
        subjectId={subject.id}
        subjectTitle={subject.title}
        conversationPanes={conversationPanes}
        availableChannels={availableChannels}
        addContacts={addContacts}
        groups={groups.map((g) => ({ id: g.id, title: g.title }))}
        header={
          <RelvoHeader
            back={backHref}
            // Titre ÉDITABLE sur place, LISIBLE EN ENTIER (2 lignes) : renommer
            // un sujet est le geste de correction le plus fréquent (Relvo devine
            // l'intitulé), il ne doit pas coûter un détour par l'onglet Détails.
            wrapTitle
            title={
              <SubjectTitleInline
                subjectId={subject.id}
                title={subject.title}
              />
            }
            // Sous-titre = la RÉFÉRENCE seule. Plus de destinataire ici (2026-07-23,
            // inutile : les conversations sont nominatives) ni de canal (un sujet
            // n'est pas toujours lié à un canal).
            subtitle={subject.reference}
            className="pb-10"
          >
            <div className="px-[22px] pt-3.5">
              {/* Domaine du sujet, dans le hero (item 2026-07-23). */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white">
                <FolderIcon className="size-3.5" strokeWidth={2.2} />
                {domainName}
              </span>
              {/* Progress bar récapitulative de l'avancement des tâches (rappel du
                fil) — posée sous le domaine, dans le hero violet. */}
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
        }
        tachesPane={
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
                      folders.find((f) => f.id === subject.folderId)?.slug ??
                      null,
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
        }
        detailPane={
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
                    <AttachmentViewer
                      key={a.id}
                      id={a.id}
                      name={a.name}
                      mimeType={a.mimeType}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ececea] bg-white px-3 py-2.5 text-left shadow-(--shadow-card) transition-colors hover:bg-(--surface-2)"
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
                    </AttachmentViewer>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title="Journal" count={events.length} icon={History}>
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
        }
      />
    </MobileFrame>
  );
}
