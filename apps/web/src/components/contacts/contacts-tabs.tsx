"use client";

import { useState } from "react";
import { SegTabs } from "@/components/shared/seg-tabs";
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
}: {
  contacts: DirectoryContact[];
  groups: DirectoryGroup[];
}) {
  const [tab, setTab] = useState<Tab>("contacts");

  return (
    <>
      <SegTabs
        options={[
          { value: "contacts", label: "Contacts", count: contacts.length },
          { value: "groupes", label: "Groupes", count: groups.length },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        overlap
      />

      {tab === "contacts" ? (
        <ContactsDirectory contacts={contacts} />
      ) : (
        <ContactsGroups groups={groups} />
      )}
    </>
  );
}
