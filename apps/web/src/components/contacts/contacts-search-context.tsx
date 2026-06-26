"use client";

import { createContext, useContext, useState } from "react";

// Petit contexte client partageant la requête de recherche entre le champ logé
// dans le hero violet et la liste alphabétique du corps de page. On évite un
// paramètre d'URL `?q=` (qui forcerait un refetch RSC à chaque frappe) : le
// filtrage est purement client, la liste complète étant déjà chargée (cache
// serveur). Voir contacts-search-field.tsx + contacts-directory.tsx.

type Ctx = { query: string; setQuery: (q: string) => void };

const ContactsSearchContext = createContext<Ctx | null>(null);

export function ContactsSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  return (
    <ContactsSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </ContactsSearchContext.Provider>
  );
}

export function useContactsSearch(): Ctx {
  const ctx = useContext(ContactsSearchContext);
  if (!ctx) {
    throw new Error(
      "useContactsSearch doit être utilisé dans <ContactsSearchProvider>",
    );
  }
  return ctx;
}
