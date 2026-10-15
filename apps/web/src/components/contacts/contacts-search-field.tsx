"use client";

import { Search, X } from "lucide-react";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";

// Champ de recherche dans le hero violet (M9.22) — même look que la barre de
// « Mon fil », mais c'est un vrai <input> qui filtre l'annuaire en direct (via
// le contexte partagé), au lieu d'un lien vers la recherche globale.
export function ContactsSearchField() {
  const { query, setQuery } = useContactsSearch();
  return (
    <div
      className="mx-4 mt-4 flex h-11 items-center gap-2.5 rounded-(--rayon-pilule) px-[15px]"
      style={{
        background: "rgb(255 255 255 / 0.16)",
        border: "1px solid rgb(255 255 255 / 0.24)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.16)",
      }}
    >
      <Search className="size-[18px] flex-none text-white/85" strokeWidth={2} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        enterKeyHint="search"
        placeholder="Rechercher un contact…"
        aria-label="Rechercher un contact"
        // 16 px : sous ce corps, iOS zoome le champ au focus. La croix native de
        // WebKit est masquée : la nôtre suffit.
        className="min-w-0 flex-1 bg-transparent text-[16px] text-white caret-white placeholder:text-white/70 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Effacer la recherche"
          className="relative grid size-6 flex-none place-items-center rounded-full bg-white/20 text-white before:absolute before:-inset-2.5 before:content-[''] active:scale-95"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}
