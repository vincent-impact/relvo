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
import { getSubjectDetail, listSubjectConversations } from "@relvo/db";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { type MessageBubbleData } from "@/components/shared/message-bubble";
import { type Recipient } from "@/components/shared/recipient-composer";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { AddTask } from "@/components/subject/add-task";
import { RelvoDraftBlock } from "@/components/subject/relvo-draft-block";
import { RelvoSummary } from "@/components/subject/relvo-summary";
import { SubjectBody } from "@/components/subject/subject-body";
import { SubjectTitleInline } from "@/components/subject/subject-title-inline";
import {
  SubjectDangerZone,
  SubjectDetailForm,
} from "@/components/subject/subject-detail-form";
import { TaskItem } from "@/components/subject/task-item";
import { cn } from "@/lib/utils";
import { contactFullName, formatRelative, initialsFor } from "@/lib/display";
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
  const [detail, folders, allContacts, subjectConversations] =
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
    senderName: m.senderContact?.name ?? m.senderName ?? m.senderRaw,
    channel: CHANNEL_LABEL[m.channel.type] ?? null,
    time: formatRelative(m.receivedAt ?? m.sentAt ?? m.createdAt),
    content: m.content ?? "",
    attachment: m.attachments[0]
      ? {
          id: m.attachments[0].id,
          name: m.attachments[0].name,
          label: m.attachments[0].aiLabel,
          mimeType: m.attachments[0].mimeType,
        }
      : null,
    // Plus de `href` (2026-07-20) : taper une bulle n'ouvre plus DIRECTEMENT la
    // fiche du message mais la pop-up d'affectation, identique à celle de
    // /conversations. La fiche message y reste accessible (« Ouvrir le
    // message ») — un lien enveloppant aurait de toute façon désarmé le tap
    // (garde `closest("a")` de MessageTapArea).
    // Interlocuteur du message → filtrage du fil par conversation.
    senderContactId: m.senderContactId,
    recipientContactId: m.recipientContactId,
  }));

  // Interlocuteurs = les contacts du sujet (un sujet peut en porter plusieurs →
  // le select permet de switcher de conversation). Relvo n'est PLUS un
  // interlocuteur ici : il s'atteint via le bouton Relvo du header (décision
  // 2026-06-27). Le canal n'est connu que pour le dernier message — affiché sur
  // le contact correspondant. La clé = id du contact (= sender/recipientContactId).
  const lastMessage = messages.at(-1);
  const lastChannel = CHANNEL_LABEL[lastMessage?.channel.type ?? ""] ?? null;
  // Dernier interlocuteur actif = contact du dernier message (expéditeur si
  // entrant, destinataire si sortant) — sélection par défaut des Conversations.
  const lastActiveContactId =
    (lastMessage?.direction === "outgoing"
      ? lastMessage?.recipientContactId
      : lastMessage?.senderContactId) ?? null;
  const interlocuteurs: Recipient[] = contacts.map((c) => ({
    key: c.id,
    name: c.name,
    kind: "human",
    initials: initialsFor(c.name) ?? undefined,
    sublabel:
      [c.company, c.id === lastActiveContactId ? lastChannel : null]
        .filter(Boolean)
        .join(" · ") || undefined,
  }));
  const defaultInterlocuteurKey =
    interlocuteurs.find((r) => r.key === lastActiveContactId)?.key ??
    interlocuteurs[0]?.key ??
    null;

  // Cibles de réponse EMAIL par interlocuteur : dernier message ENTRANT reçu
  // par email de ce contact → son adresse (senderRaw) + le canal email à
  // réutiliser pour répondre. Un interlocuteur sans entrée ici n'est pas
  // joignable par email (sujet créé à la main, ou canal WhatsApp = M6) → le
  // composer le signalera au lieu d'envoyer.
  const emailReplyTargets: Record<
    string,
    { channelId: string; email: string }
  > = {};
  // Cibles de réponse WHATSAPP par interlocuteur : dernier message ENTRANT reçu
  // par WhatsApp de ce contact → le fil (chat_id = externalThreadId) + le canal à
  // réutiliser pour répondre. Un interlocuteur sans fil ici n'est pas joignable
  // par WhatsApp → le composer bascule sur l'email ou le signale.
  const whatsappReplyTargets: Record<
    string,
    { channelId: string; chatId: string }
  > = {};

  // Base : les CONVERSATIONS du sujet. Une conversation dit par où répondre
  // (canal + interlocuteur + fil), et elle existe DÈS le rattachement — alors
  // que les messages, eux, n'arrivent qu'après. Sans ça, un interlocuteur ajouté
  // par le cas S serait injoignable tant qu'il n'aurait pas écrit le premier,
  // ce qui viderait l'extension de tout intérêt.
  for (const c of subjectConversations) {
    if (!c.contactId || !c.interlocutorRaw) continue;
    if (c.channelType === "email") {
      emailReplyTargets[c.contactId] = {
        channelId: c.channelId,
        email: c.interlocutorRaw,
      };
    } else if (c.externalThreadId) {
      whatsappReplyTargets[c.contactId] = {
        channelId: c.channelId,
        chatId: c.externalThreadId,
      };
    }
  }

  // Puis les messages, qui priment : une adresse vue en vrai dans un message
  // entrant est plus sûre que celle déduite de la fiche contact.
  for (const m of messages) {
    if (m.direction === "incoming" && m.senderContactId) {
      if (m.channel.type === "email" && m.senderRaw) {
        emailReplyTargets[m.senderContactId] = {
          channelId: m.channelId,
          email: m.senderRaw,
        };
      } else if (m.channel.type === "whatsapp" && m.externalThreadId) {
        whatsappReplyTargets[m.senderContactId] = {
          channelId: m.channelId,
          chatId: m.externalThreadId,
        };
      }
    }
  }

  // Sujet issu d'un GROUPE WhatsApp (1 groupe = 1 sujet) → le composer répond au
  // GROUPE (« Groupe ») par défaut, pas à un membre. Détection robuste :
  //   • signal principal = le flag `is_group` du webhook ;
  //   • repli = un fil WhatsApp avec ≥ 2 expéditeurs distincts EST un groupe
  //     (couvre les messages ingérés AVANT la capture de is_group, ou un webhook
  //     qui ne le renseignerait pas).
  // Cible d'envoi = le fil (chat_id) du dernier message entrant WhatsApp — un
  // seul envoi réel au groupe.
  const waIncoming = messages.filter(
    (m) => m.channel.type === "whatsapp" && m.direction === "incoming",
  );
  const distinctWaSenders = new Set(
    waIncoming
      .map((m) => m.senderContactId ?? m.senderRaw)
      .filter((v): v is string => Boolean(v)),
  );
  const isGroupSubject =
    messages.some((m) => m.isGroup) || distinctWaSenders.size > 1;
  const groupWaMessage = isGroupSubject
    ? waIncoming.filter((m) => m.externalThreadId).at(-1)
    : undefined;
  const groupWhatsappTarget = groupWaMessage?.externalThreadId
    ? {
        channelId: groupWaMessage.channelId,
        chatId: groupWaMessage.externalThreadId,
      }
    : null;

  // Cas S (M6bis.12) — à qui d'autre peut-on écrire à propos de ce sujet ? Les
  // contacts pas encore interlocuteurs, et joignables (email ou téléphone).
  // Un sujet FERMÉ n'est plus extensible (la fenêtre est figée) → aucun candidat.
  const extendCandidates =
    subject.status === "open"
      ? allContacts
          .filter(
            (c) =>
              !subject.contactIds.includes(c.id) && Boolean(c.email || c.phone),
          )
          .map((c) => ({
            id: c.id,
            name: contactFullName(c),
            company: c.company,
            email: c.email,
            phone: c.phone,
          }))
      : [];

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />
      <PollRefresh />

      <SubjectBody
        defaultTab={
          (["messages", "taches", "detail"] as const).includes(
            (tab ?? "") as "messages" | "taches" | "detail",
          )
            ? (tab as "messages" | "taches" | "detail")
            : "messages"
        }
        tasksCount={tasks.length}
        bubbles={bubbles}
        draft={draftContent ? <RelvoDraftBlock text={draftContent} /> : null}
        interlocuteurs={interlocuteurs}
        defaultInterlocuteurKey={defaultInterlocuteurKey}
        subjectId={subject.id}
        subjectTitle={subject.title}
        subjectRef={{
          id: subject.id,
          reference: subject.reference,
          title: subject.title,
          folder: folders.find((f) => f.id === subject.folderId) ?? null,
        }}
        emailReplyTargets={emailReplyTargets}
        whatsappReplyTargets={whatsappReplyTargets}
        isGroupSubject={isGroupSubject}
        groupWhatsappTarget={groupWhatsappTarget}
        extendCandidates={extendCandidates}
        header={
          <RelvoHeader
            back={backHref}
            // Titre ÉDITABLE sur place : renommer un sujet est le geste de
            // correction le plus fréquent (Relvo devine l'intitulé), il ne doit
            // pas coûter un détour par l'onglet Détails — qui reste disponible.
            title={
              <SubjectTitleInline
                subjectId={subject.id}
                title={subject.title}
              />
            }
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
