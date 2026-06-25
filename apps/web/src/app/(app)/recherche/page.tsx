import { Suspense } from "react";
import Link from "next/link";
import { enrichSubjects } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { SearchBar } from "@/components/search/search-bar";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { SectionLabel } from "@/components/shared/section-label";
import { SubjectRow, toSubjectRowData } from "@/components/shared/subject-row";
import { getTenantDb } from "@/server/auth-context";

// Recherche globale (M9.13, Direction B) — un seul champ dans le hero violet,
// résultats sur sujets + contacts + messages. Insensible à la casse. Requête
// directe (Prisma) ; pas de RAG (invariant n°29 : recherche structurée).
//
// PERF (M9.19, point 2) : le hero + le champ s'affichent instantanément ; les
// résultats streament dans un <Suspense> (re-déclenché à chaque requête via key).

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function SearchResults({ query }: { query: string }) {
  const db = await getTenantDb();
  const contains = { contains: query, mode: "insensitive" as const };

  const [subjects, contacts, messages] = await Promise.all([
    db.subject.findMany({
      where: {
        OR: [
          { title: contains },
          { reference: contains },
          { summary: contains },
        ],
      },
      orderBy: { lastActivityAt: "desc" },
      take: 12,
    }),
    db.contact.findMany({
      where: { OR: [{ name: contains }, { company: contains }] },
      orderBy: { name: "asc" },
      take: 12,
      select: { id: true, name: true, company: true, jobTitle: true },
    }),
    db.message.findMany({
      where: { content: contains },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        content: true,
        subjectId: true,
        subject: { select: { id: true, reference: true, title: true } },
      },
    }),
  ]);

  const rows = (await enrichSubjects(db, subjects)).map(toSubjectRowData);
  const total = rows.length + contacts.length + messages.length;

  if (total === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun résultat pour «&nbsp;{query}&nbsp;».
      </p>
    );
  }

  return (
    <>
      {rows.length > 0 ? (
        <>
          <SectionLabel title="Sujets" />
          <div className="pt-1">
            {rows.map((row) => (
              <SubjectRow key={row.id} data={row} />
            ))}
          </div>
        </>
      ) : null}

      {contacts.length > 0 ? (
        <>
          <SectionLabel title="Contacts" dotColor="var(--amber-600)" />
          <div className="pt-1">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="mx-[14px] flex items-center gap-3 border-b border-[#f1efeb] px-[18px] py-3.5"
              >
                <span className="grid size-[42px] flex-none place-items-center rounded-full bg-(--amber-600) text-[14px] font-extrabold text-white">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-bold">{c.name}</div>
                  {c.company || c.jobTitle ? (
                    <div className="mt-0.5 truncate text-[13px] text-[#86857d]">
                      {[c.jobTitle, c.company].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {messages.length > 0 ? (
        <>
          <SectionLabel title="Messages" dotColor="var(--relvo)" />
          <div className="space-y-2.5 px-4 pt-2">
            {messages.map((msg) => (
              <Link
                key={msg.id}
                href={msg.subject ? `/sujets/${msg.subject.id}` : "/messages"}
                className="block rounded-2xl border border-(--border-light) bg-white p-3.5 shadow-(--shadow-card)"
              >
                {msg.subject ? (
                  <div className="mb-1 font-numeric text-[10.5px] font-semibold tracking-[0.3px] text-(--text-tertiary)">
                    {msg.subject.reference} · {msg.subject.title}
                  </div>
                ) : null}
                <p className="line-clamp-2 text-[13.5px] leading-[1.45] text-(--text-secondary)">
                  {msg.content ?? "—"}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return (
    <Screen>
      <RelvoHeader back="/fil" title="Recherche" className="pb-9">
        <SearchBar initial={query} />
      </RelvoHeader>

      {!query ? (
        <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
          Cherchez un sujet, un contact ou un message.
        </p>
      ) : (
        <Suspense key={query} fallback={<RowsSkeleton count={4} />}>
          <SearchResults query={query} />
        </Suspense>
      )}
    </Screen>
  );
}
