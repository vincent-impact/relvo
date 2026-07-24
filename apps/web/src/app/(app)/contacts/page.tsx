import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listConversationGroups } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ContactsTabs } from "@/components/contacts/contacts-tabs";
import { ContactsSearchField } from "@/components/contacts/contacts-search-field";
import { ContactsSearchProvider } from "@/components/contacts/contacts-search-context";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedContactCount, cachedContacts } from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import { formatRelative } from "@/lib/display";

// Contacts (M9.22, Direction B) — annuaire de premier rang (3e onglet du dock).
// Répertoire façon agenda : recherche dans le hero (filtre en direct) + sections
// alphabétiques par nom de famille + ajout manuel d'un contact (bouton +).
//
// PERF (M9.19) : hero instantané (compteur = count léger) ; l'annuaire stream
// dans un <Suspense>, servi depuis le cache serveur. Le filtrage/groupement est
// 100 % client (cf. ContactsDirectory) — pas de refetch à la frappe.

async function ContactsBody({ accountId }: { accountId: string }) {
  const db = await getTenantDb();
  const [contacts, groups] = await Promise.all([
    cachedContacts(accountId),
    listConversationGroups(db),
  ]);
  return (
    <ContactsTabs
      contacts={contacts}
      groups={groups.map((g) => ({
        id: g.id,
        title: g.title,
        time: formatRelative(g.lastMessageAt) ?? "",
      }))}
    />
  );
}

export default async function ContactsPage() {
  const accountId = await requireAccountId();
  const total = await cachedContactCount(accountId);

  return (
    <ContactsSearchProvider>
      <Screen>
        <RelvoHeader
          title="Contacts"
          subtitle={`${total} contact${total > 1 ? "s" : ""}`}
          className="pb-[38px]"
          action={
            <Link
              href="/contacts/nouveau"
              aria-label="Nouveau contact"
              className="grid size-[42px] flex-none place-items-center rounded-full text-white active:scale-95"
              style={{
                background: "rgb(255 255 255 / 0.15)",
                boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
              }}
            >
              <Plus className="size-[22px]" strokeWidth={2.2} />
            </Link>
          }
        >
          <ContactsSearchField />
        </RelvoHeader>

        <Suspense fallback={<RowsSkeleton count={6} />}>
          <ContactsBody accountId={accountId} />
        </Suspense>
      </Screen>
    </ContactsSearchProvider>
  );
}
