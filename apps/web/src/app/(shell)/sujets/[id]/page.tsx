import { notFound } from "next/navigation";
import { FileText, Hourglass, Sparkles, SquareCheck } from "lucide-react";
import {
  getSubjectDetail,
  listChannels,
  listConversationGroups,
  listSubjectConversationRows,
  resolveReplyTargets,
} from "@relvo/db";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { InformationsPane } from "@/components/subject/informations-pane";
import { JournalPane } from "@/components/subject/journal-pane";
import { SubjectBody } from "@/components/subject/subject-body";
import { SubjectConversationsList } from "@/components/subject/subject-conversations-list";
import { SubjectTitleInline } from "@/components/subject/subject-title-inline";
import { toConversationRowData } from "@/lib/conversation-row";
import { contactFullName, formatRelative } from "@/lib/display";
import { relvoTaskInfo } from "@/lib/task-item-data";
import { getTenantDb } from "@/server/auth-context";

// Fiche Sujet (2026-09-15) — hero violet (titre éditable + progression), 4
// onglets Informations (domaine, résumé, TÂCHES) / Conversations / Documents /
// Journal. Les conversations sont une LISTE : on clique une ligne pour ouvrir la
// conversation dans son écran dédié (`/conversations/[id]`), seule surface
// d'affichage — on répond là-bas.

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
  const [detail, folders, allContacts, conversationRows, channels, groups] =
    await Promise.all([
      getSubjectDetail(db, id),
      db.folder.findMany({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, color: true, icon: true },
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
      // Conversations du sujet, projetées en lignes de liste (objet, aperçu,
      // non-lus, canal). La fiche ne rend plus le fil : elle liste et renvoie vers
      // l'écran conversation.
      listSubjectConversationRows(db, id),
      // Canaux connectés + groupes existants → dialog « Ajouter une conversation ».
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

  const { subject, contacts, tasks, events, attachments } = detail;
  // Le fil dans lequel chaque tâche se répond d'un appui (M7.7).
  const replyTargets = await resolveReplyTargets(db, tasks);
  // Contacts joignables pour le dialog « Ajouter une conversation ».
  const addContacts = allContacts.map((c) => ({
    id: c.id,
    name: contactFullName(c),
    email: c.email,
    phone: c.phone,
  }));

  const rows = conversationRows.map(toConversationRowData);

  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

  return (
    <MobileFrame>
      <AcknowledgeOnOpen subjectId={subject.id} />
      <PollRefresh />

      <SubjectBody
        defaultTab={
          (
            ["informations", "conversations", "documents", "journal"] as const
          ).includes(
            (tab ?? "") as
              | "informations"
              | "conversations"
              | "documents"
              | "journal",
          )
            ? (tab as
                | "informations"
                | "conversations"
                | "documents"
                | "journal")
            : "informations"
        }
        tasksCount={tasks.filter((t) => t.status !== "done").length}
        conversationsCount={rows.length}
        conversationsHasNew={rows.some((r) => r.unreadCount > 0)}
        informationsPane={
          <InformationsPane
            subjectId={subject.id}
            description={subject.description}
            folders={folders}
            folderId={subject.folderId}
            priority={subject.priority}
            subjectTitle={subject.title}
            tasks={tasks.map((t) => ({
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
                folders.find((f) => f.id === subject.folderId)?.slug ?? null,
              relvo: relvoTaskInfo(t.metadata),
              replyConversationId: replyTargets.get(t.id) ?? null,
            }))}
            // Ce que Relvo a rédigé à la structuration (M7.6) : le résumé court,
            // affiché tant que l'utilisateur n'a pas écrit le sien.
            relvo={
              subject.situationUpdatedAt ? { summary: subject.summary } : null
            }
            // Avec qui on dialogue (retour du 2026-09-16) : le domaine dit de
            // quoi on parle, l'interlocuteur dit avec qui — les deux en tête.
            contacts={contacts}
          />
        }
        conversationsPane={
          <SubjectConversationsList
            subjectId={subject.id}
            subjectTitle={subject.title}
            rows={rows}
            availableChannels={availableChannels}
            addContacts={addContacts}
            groups={groups.map((g) => ({ id: g.id, title: g.title }))}
          />
        }
        documentsCount={attachments.length}
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
            // Sous-titre = la RÉFÉRENCE seule.
            subtitle={subject.reference}
            className="pb-10"
          >
            <div className="space-y-3 px-[22px] pt-3.5">
              {/* Les MARQUEURS du sujet (04 §9), les mêmes que sur sa ligne dans
                  la liste : la fiche ne doit pas en savoir moins que la liste
                  (retour du 2026-09-16). Le statut terminal aussi. */}
              {subject.status !== "open" ||
              subject.waitingForReply ||
              subject.resolutionSuggestedAt ? (
                <div className="flex flex-wrap items-center gap-2">
                  {subject.status === "validated" ? (
                    <HeaderPill>Validé</HeaderPill>
                  ) : subject.status === "closed" ? (
                    <HeaderPill>Fermé</HeaderPill>
                  ) : null}
                  {subject.waitingForReply ? (
                    <HeaderPill>
                      <Hourglass className="size-3" strokeWidth={2.2} />
                      En attente
                    </HeaderPill>
                  ) : null}
                  {subject.status === "open" &&
                  subject.resolutionSuggestedAt ? (
                    <HeaderPill accent>
                      <Sparkles className="size-3" strokeWidth={2.2} />À valider
                      ?
                    </HeaderPill>
                  ) : null}
                </div>
              ) : null}
              {/* Le domaine vit dans l'onglet Informations. Reste la progression. */}
              {taskTotal > 0 ? (
                <div className="flex items-center gap-2.5">
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
        documentsPane={
          <div className="px-4 pt-4 pb-2">
            <p className="mb-3 text-[12.5px] leading-[1.4] text-(--text-tertiary)">
              Les pièces jointes reçues dans les conversations du sujet
              s’accumulent ici.
            </p>
            {attachments.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-(--text-tertiary)">
                Aucun document pour l’instant.
              </p>
            ) : (
              <div className="space-y-2">
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
          </div>
        }
        journalCount={events.length}
        journalPane={<JournalPane events={events} />}
      />
    </MobileFrame>
  );
}

/** Une pastille de marqueur dans le hero violet : verre clair, ou plein blanc quand Relvo appelle une décision. */
function HeaderPill({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={
        accent
          ? "inline-flex items-center gap-1 rounded-full bg-white px-[9px] py-[3px] text-[11.5px] font-bold whitespace-nowrap text-relvo"
          : "inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[11.5px] font-bold whitespace-nowrap text-white"
      }
      style={
        accent
          ? undefined
          : {
              background: "rgb(255 255 255 / 0.14)",
              border: "1px solid rgb(255 255 255 / 0.28)",
            }
      }
    >
      {children}
    </span>
  );
}
