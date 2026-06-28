"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  ContactsDirectory,
  type DirectoryContact,
} from "@/components/contacts/contacts-directory";
import {
  ContactsSearchProvider,
  useContactsSearch,
} from "@/components/contacts/contacts-search-context";

// Annuaire Contacts embarqué dans l'onglet « Contacts » des Réglages (le dock ne
// porte plus Contacts depuis le 2026-06-28). Réutilise ContactsDirectory + le
// contexte de recherche, mais avec un champ sur fond BLANC (pas le hero violet).

function SearchInput() {
  const { query, setQuery } = useContactsSearch();
  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl border border-(--border) bg-white px-3 py-2.5">
      <Search
        className="size-[18px] flex-none text-(--text-tertiary)"
        strokeWidth={2}
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un contact…"
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
      />
    </div>
  );
}

export function ContactsPane({ contacts }: { contacts: DirectoryContact[] }) {
  return (
    <ContactsSearchProvider>
      <div className="flex items-center gap-2 px-4 pt-5">
        <SearchInput />
        <Link
          href="/contacts/nouveau"
          aria-label="Nouveau contact"
          className="grid size-[44px] flex-none place-items-center rounded-xl bg-relvo text-white active:scale-95"
        >
          <Plus className="size-[20px]" strokeWidth={2.4} />
        </Link>
      </div>
      <div className="pt-1">
        <ContactsDirectory contacts={contacts} />
      </div>
    </ContactsSearchProvider>
  );
}
