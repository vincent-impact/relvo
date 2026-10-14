"use client";

import { useState } from "react";
import { IndicatorTabs } from "@/components/shared/indicator-tabs";
import {
  ContactsDirectory,
  type DirectoryContact,
} from "@/components/contacts/contacts-directory";
import {
  ContactsGroups,
  type DirectoryGroup,
} from "@/components/contacts/contacts-groups";

// Annuaire à DEUX onglets (2026-07-24) : « Contacts » (personnes) et « Groupes »
// (conversations WhatsApp de groupe). Un contact peut être un interlocuteur
// direct (e-mail et WhatsApp) ; un groupe est propre à WhatsApp et vit côté
// Conversation, d'où la séparation. La recherche du hero filtre les deux via le
// contexte partagé.

type Tab = "contacts" | "groupes";

export function ContactsTabs({
  contacts,
  groups,
  defaultTab = "contacts",
}: {
  contacts: DirectoryContact[];
  groups: DirectoryGroup[];
  /** Onglet actif initial — deep-link (?tab=groupes) au retour d'un groupe. */
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <>
      <IndicatorTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "contacts", label: "contacts", count: contacts.length },
          { key: "groupes", label: "groupes", count: groups.length },
        ]}
      />

      {tab === "contacts" ? (
        <ContactsDirectory contacts={contacts} />
      ) : (
        <ContactsGroups groups={groups} />
      )}
    </>
  );
}
