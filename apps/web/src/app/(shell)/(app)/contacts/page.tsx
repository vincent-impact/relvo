import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listConversationGroups } from "@relvo/db";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ContactsTabs } from "@/components/contacts/contacts-tabs";
import { ContactsSearchField } from "@/components/contacts/contacts-search-field";
import { ContactsSearchProvider } from "@/components/contacts/contacts-search-context";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedContacts } from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import { formatRelative } from "@/lib/display";

// Contacts (M9.22, Direction B) — annuaire de premier rang (3e onglet du dock).
// Répertoire façon agenda : recherche dans le hero (filtre en direct) + sections
// alphabétiques par nom de famille + ajout manuel d'un contact (bouton +).
//
// PERF (M9.19) : hero instantané (compteur = count léger) ; l'annuaire stream
// dans un <Suspense>, servi depuis le cache serveur. Le filtrage/groupement est
// 100 % client (cf. ContactsDirectory) — pas de refetch à la frappe.

async function ContactsBody({
  accountId,
  defaultTab,
}: {
  accountId: string;
  defaultTab: "contacts" | "groupes";
}) {
  const db = await getTenantDb();
  const [contacts, groups] = await Promise.all([
    cachedContacts(accountId),
    listConversationGroups(db),
  ]);
  return (
    <ContactsTabs
      defaultTab={defaultTab}
      contacts={contacts}
      groups={groups.map((g) => ({
        id: g.id,
        title: g.title,
        time: formatRelative(g.lastMessageAt) ?? "",
      }))}
    />
  );
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const accountId = await requireAccountId();
  const { tab } = await searchParams;
  const defaultTab = tab === "groupes" ? "groupes" : "contacts";

  return (
    <ContactsSearchProvider>
      <Screen>
        {/* Pas de sous-titre : l'indicateur cerclé dit déjà « 20 contacts ». */}
        <RelvoHeader
          title="Contacts"
          className="pb-[38px]"
          action={
            <Link
              href="/contacts/nouveau"
              aria-label="Nouveau contact"
              className={SKY_BTN}
            >
              <Plus className="size-[18px]" strokeWidth={2.4} />
            </Link>
          }
        >
          <ContactsSearchField />
        </RelvoHeader>

        <Suspense fallback={<RowsSkeleton count={6} />}>
          <ContactsBody accountId={accountId} defaultTab={defaultTab} />
        </Suspense>
      </Screen>
    </ContactsSearchProvider>
  );
}
