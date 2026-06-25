import { Suspense } from "react";
import Link from "next/link";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedContactCount, cachedContacts } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Contacts (M9.10, Direction B) — annuaire en lignes + filtre « À compléter »
// (contacts créés par Relvo, status=auto). Un contact n'existe qu'à la création
// d'un sujet (invariant n°12). Le tap ouvre la fiche /contacts/[id].
//
// PERF (M9.19, point 2) : le hero (avec le compteur, requête count légère)
// s'affiche instantanément ; l'annuaire stream dans un <Suspense>.

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ContactRow({
  contact,
}: {
  contact: {
    id: string;
    name: string;
    company: string | null;
    jobTitle: string | null;
    status: string;
  };
}) {
  const sub = [contact.jobTitle, contact.company].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="mx-[14px] flex items-center gap-3 border-b border-[#f1efeb] px-[18px] py-3.5"
    >
      <span className="grid size-[42px] flex-none place-items-center rounded-full bg-(--amber-600) text-[14px] font-extrabold text-white">
        {initials(contact.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-bold">{contact.name}</div>
        {sub ? (
          <div className="mt-0.5 truncate text-[13px] text-[#86857d]">
            {sub}
          </div>
        ) : null}
      </div>
      {contact.status === "auto" ? (
        <span className="flex-none rounded-full bg-(--amber-50) px-2.5 py-1 text-[11px] font-bold text-(--amber-800)">
          À compléter
        </span>
      ) : null}
    </Link>
  );
}

async function ContactsList({ accountId }: { accountId: string }) {
  const contacts = await cachedContacts(accountId);
  const toComplete = contacts.filter((c) => c.status === "auto");

  return (
    <FeedTabs
      options={[
        { value: "tous", label: "Tous", count: contacts.length },
        { value: "complete", label: "À compléter", count: toComplete.length },
      ]}
      panes={{
        tous: (
          <div className="pt-1">
            {contacts.length === 0 ? (
              <p className="px-[22px] py-8 text-center text-[13.5px] text-(--text-tertiary)">
                Aucun contact.
              </p>
            ) : (
              contacts.map((c) => <ContactRow key={c.id} contact={c} />)
            )}
          </div>
        ),
        complete: (
          <div className="pt-1">
            {toComplete.length === 0 ? (
              <p className="px-[22px] py-8 text-center text-[13.5px] text-(--text-tertiary)">
                Tous vos contacts sont complets. ✦
              </p>
            ) : (
              toComplete.map((c) => <ContactRow key={c.id} contact={c} />)
            )}
          </div>
        ),
      }}
    />
  );
}

export default async function ContactsPage() {
  const accountId = await requireAccountId();
  const total = await cachedContactCount(accountId);

  return (
    <Screen>
      <RelvoHeader
        back="/"
        title="Contacts"
        subtitle={`${total} contact${total > 1 ? "s" : ""}`}
        className="pb-9"
      />
      <Suspense fallback={<RowsSkeleton count={6} />}>
        <ContactsList accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
