import { notFound } from "next/navigation";
import { Hourglass } from "@/components/shared/picto";
import {
  getSubjectDetail,
  listChannels,
  listConversationGroups,
  listSubjectConversationRows,
  resolveReplyTargets,
  listFolderOptions,
} from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { ListPanel } from "@/components/shared/list-panel";
import { SubjectFolderEyebrow } from "@/components/subject/subject-folder-eyebrow";
import { jourParis } from "@relvo/db/temps";
import { AcknowledgeOnOpen } from "@/components/subject/acknowledge-on-open";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { DocumentRow } from "@/components/subject/document-row";
import { InformationsPane } from "@/components/subject/informations-pane";
import { JournalPane } from "@/components/subject/journal-pane";
import { SubjectBody } from "@/components/subject/subject-body";
import { SubjectConversationsList } from "@/components/subject/subject-conversations-list";
import { SubjectTitleInline } from "@/components/subject/subject-title-inline";
import { toConversationRowData } from "@/lib/conversation-row";
import { contactFullName, formatRelative } from "@/lib/display";
import { relvoTaskInfo, taskDecisionsInfo } from "@/lib/task-item-data";
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
      // Les dossiers en ordre d'arbre, avec leur chemin et la bande de leur
      // premier niveau (M23.4) ; Général n'en est pas (invariant 17).
      listFolderOptions(db),
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

  // Le retard d'une tâche se dérive ici comme partout (lib/task-item-data) :
  // une échéance passée sur une tâche ouverte se lit barrée, en rouge.
  const todayKey = jourParis(new Date());
  const hasHeroChips =
    subject.status === "validated" ||
    subject.status === "closed" ||
    subject.waitingForReply;

  return (
    <>
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
              overdue:
                t.status !== "done" &&
                t.startDate != null &&
                t.startDate.toISOString().slice(0, 10) < todayKey,
              subjectId: subject.id,
              subjectTitle: subject.title,
              folderSlug:
                folders.find((f) => f.id === subject.folderId)?.slug ?? null,
              relvo: relvoTaskInfo(t.metadata),
              replyConversationId: replyTargets.get(t.id) ?? null,
              decisions: taskDecisionsInfo(t.metadata),
            }))}
            // Ce que Relvo a rédigé à la structuration (M7.6) : le résumé court,
            // affiché tant que l'utilisateur n'a pas écrit le sien.
            relvo={
              subject.situationUpdatedAt
                ? {
                    summary: subject.summary,
                    situation: {
                      where: subject.situationWhere,
                      nextStep: subject.situationNextStep,
                      waitingFor: subject.situationWaitingFor,
                      deadline:
                        subject.situationDeadline?.toISOString().slice(0, 10) ??
                        null,
                    },
                  }
                : null
            }
            // Avec qui on dialogue (retour du 2026-09-16) : le domaine dit de
            // quoi on parle, l'interlocuteur dit avec qui — les deux en tête.
            contacts={contacts}
            reference={subject.reference}
            // Ce que Relvo conclut : le bandeau de résolution remplace le chip
            // « À valider ? » qui décorait le hero sans rien pouvoir déclencher.
            resolutionSuggested={
              subject.status === "open" && subject.resolutionSuggestedAt != null
            }
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
            // Le domaine du sujet en tête, comme sur sa ligne : la bande et le
            // nom — et c'est là qu'il se change.
            eyebrow={
              <SubjectFolderEyebrow
                subjectId={subject.id}
                folders={folders}
                folderId={subject.folderId}
              />
            }
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
            // Sous-titre = les MARQUEURS du sujet (04 §9) en petits chips, les
            // mêmes que sur sa ligne dans la liste. Pas de référence : personne
            // ne reconnaît un sujet à son code. Sans marqueur, pas de ligne.
            subtitle={
              hasHeroChips ? (
                <span className="inline-flex items-center gap-2.5">
                  {subject.status === "validated" ? (
                    <HeroChip>Validé</HeroChip>
                  ) : subject.status === "closed" ? (
                    <HeroChip>Fermé</HeroChip>
                  ) : null}
                  {subject.waitingForReply ? (
                    <HeroChip>
                      <Hourglass className="size-[11px]" />
                      En attente
                    </HeroChip>
                  ) : null}
                </span>
              ) : undefined
            }
            className="pb-10"
          />
        }
        documentsPane={
          // Une liste = une carte (02-composants) ; l'explication ne vit que
          // dans l'état vide, une liste qui existe s'explique seule.
          attachments.length === 0 ? (
            <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
              Aucun document pour l’instant. Les pièces jointes reçues dans les
              conversations de l’affaire s’accumulent ici.
            </p>
          ) : (
            <div className="pt-3 pb-2">
              <ListPanel>
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    data-list-row
                    className="border-b border-(--filet)"
                  >
                    <DocumentRow
                      id={a.id}
                      name={a.name}
                      mimeType={a.mimeType}
                      label={a.aiLabel}
                      time={formatRelative(a.createdAt)}
                    />
                  </div>
                ))}
              </ListPanel>
            </div>
          )
        }
        journalCount={events.length}
        journalPane={<JournalPane events={events} />}
      />
    </>
  );
}

/**
 * Un marqueur d'ÉTAT dans le sous-titre du hero : verre clair sur le violet.
 * Il ne porte que ce qui se constate (« Validé », « Fermé », « En attente »).
 * Ce que Relvo PROPOSE ne vit plus ici : une suggestion appelle une décision,
 * et un chip ne peut rien déclencher — c'est le bandeau de résolution de la
 * fiche qui la porte (cf. ResolutionBanner).
 */
function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-(--rayon-pilule) bg-white/14 px-2 py-px text-[11px] font-medium tracking-[0.06em] whitespace-nowrap text-white">
      {children}
    </span>
  );
}
