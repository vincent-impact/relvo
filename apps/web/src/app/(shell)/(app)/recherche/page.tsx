import { Suspense } from "react";
import { enrichSubjects } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { SearchBar } from "@/components/search/search-bar";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { SubjectRow, toSubjectRowData } from "@/components/shared/subject-row";
import { getTenantDb } from "@/server/auth-context";

// Recherche de SUJETS (M9.13, Direction B) — un seul champ dans le hero violet.
// La recherche ne porte QUE sur les sujets : titre / référence / résumé, ET les
// contacts rattachés (taper le nom d'un contact remonte ses sujets). Les
// contacts ont leur propre annuaire (/contacts) ; pas de section contact ici.
// Insensible à la casse, requête directe Prisma (pas de RAG — invariant n°29).
//
// PERF (M9.19, point 2) : le hero + le champ s'affichent instantanément ; les
// résultats streament dans un <Suspense> (re-déclenché à chaque requête via key).

async function SearchResults({ query }: { query: string }) {
  const db = await getTenantDb();
  const contains = { contains: query, mode: "insensitive" as const };

  // Contacts dont le nom/société matche → on remonte leurs sujets rattachés
  // (Subject.contactIds), pas les contacts eux-mêmes.
  const matchedContacts = await db.contact.findMany({
    where: {
      OR: [
        { firstName: contains },
        { lastName: contains },
        { company: contains },
      ],
    },
    select: { id: true },
  });
  const contactIds = matchedContacts.map((c) => c.id);

  const subjects = await db.subject.findMany({
    where: {
      OR: [
        { title: contains },
        { reference: contains },
        { summary: contains },
        ...(contactIds.length ? [{ contactIds: { hasSome: contactIds } }] : []),
      ],
    },
    orderBy: { lastActivityAt: "desc" },
    take: 24,
  });

  const rows = (await enrichSubjects(db, subjects)).map(toSubjectRowData);

  if (rows.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun sujet pour «&nbsp;{query}&nbsp;».
      </p>
    );
  }

  return (
    <div className="pt-2">
      {rows.map((row) => (
        <SubjectRow key={row.id} data={row} />
      ))}
    </div>
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
          Cherchez un sujet par son titre, sa référence ou un contact rattaché.
        </p>
      ) : (
        <Suspense key={query} fallback={<RowsSkeleton count={4} />}>
          <SearchResults query={query} />
        </Suspense>
      )}
    </Screen>
  );
}
