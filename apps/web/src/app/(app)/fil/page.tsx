import Link from "next/link";
import { Search } from "lucide-react";
import {
  type EnrichedSubject,
  enrichSubjects,
  getPriorityFeed,
} from "@relvo/db";
import { AppBar, PageBody } from "@/components/layout/app-bar";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import {
  SubjectCard,
  toSubjectCardData,
} from "@/components/shared/subject-card";
import { getTenantDb } from "@/server/auth-context";

// Mon fil (M9.4) — traitement des sujets. Feed colonne unique + filtres
// (Priorité / Ouverts / Terminés) + bandeau Relvo + paire ✕/✓ sur chaque carte.

const CLOSED = ["resolved", "archived"] as const;

function FeedList({
  items,
  options,
}: {
  items: EnrichedSubject[];
  options: {
    tone?: "default" | "low" | "done";
    summary?: boolean;
    actions?: boolean;
  };
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-(--border-light) bg-white p-6 text-center text-[13.5px] text-(--text-tertiary)">
        Rien ici pour le moment.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((e) => {
        const card = toSubjectCardData(e);
        const tone =
          options.tone ?? (card.priority === "low" ? "low" : "default");
        // Cartes traitables (Priorité/Ouverts) = swipe ; Terminés = lien simple.
        if (options.actions) {
          return (
            <SwipeableSubject
              key={card.id}
              subjectId={card.id}
              canIgnore={card.priority !== "low"}
            >
              <SubjectCard
                data={card}
                tone={tone}
                showSummary={options.summary ?? false}
                linkable={false}
              />
            </SwipeableSubject>
          );
        }
        return (
          <SubjectCard
            key={card.id}
            data={card}
            tone={tone}
            showSummary={options.summary ?? false}
          />
        );
      })}
    </div>
  );
}

export default async function FilPage() {
  const db = await getTenantDb();

  const [priorityPage, openSubjects, resolvedSubjects, openCount] =
    await Promise.all([
      getPriorityFeed(db, { limit: 20 }),
      db.subject.findMany({
        where: { status: { notIn: [...CLOSED] } },
        orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
        take: 40,
      }),
      db.subject.findMany({
        where: { status: "resolved" },
        orderBy: [{ resolvedAt: "desc" }],
        take: 40,
      }),
      db.subject.count({ where: { status: { notIn: [...CLOSED] } } }),
    ]);

  const [prio, ouverts, termines] = await Promise.all([
    enrichSubjects(db, priorityPage.items),
    enrichSubjects(db, openSubjects),
    enrichSubjects(db, resolvedSubjects),
  ]);

  return (
    <>
      <AppBar
        title="Mon fil"
        subtitle={`${openCount} sujet${openCount > 1 ? "s" : ""} ouvert${openCount > 1 ? "s" : ""}`}
        action={
          <button
            type="button"
            aria-label="Recherche"
            className="grid size-[38px] flex-none place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
          >
            <Search className="size-[19px]" strokeWidth={2} />
          </button>
        }
      />
      <PageBody className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-(--purple-100) bg-relvo-bg px-3 py-2.5">
          <span className="text-[15px] text-relvo">✦</span>
          <p className="flex-1 text-[13px] text-brand-dark">
            Aujourd'hui : {prio.length} sujet{prio.length > 1 ? "s" : ""}{" "}
            prioritaire{prio.length > 1 ? "s" : ""} à traiter.
          </p>
          <Link
            href="/messages"
            className="text-[12.5px] font-bold whitespace-nowrap text-relvo"
          >
            Messages →
          </Link>
        </div>

        <FeedTabs
          options={[
            { value: "prio", label: "Priorité" },
            { value: "ouverts", label: "Ouverts" },
            { value: "termines", label: "Terminés" },
          ]}
          panes={{
            prio: (
              <FeedList
                items={prio}
                options={{ summary: true, actions: true }}
              />
            ),
            ouverts: <FeedList items={ouverts} options={{ actions: true }} />,
            termines: <FeedList items={termines} options={{ tone: "done" }} />,
          }}
        />
      </PageBody>
    </>
  );
}
