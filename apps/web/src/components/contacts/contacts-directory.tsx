"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";

export type DirectoryContact = {
  id: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  status: string;
};

// Annuaire Contacts (M9.22) — façon répertoire téléphonique : sections par 1ʳᵉ
// lettre du NOM DE FAMILLE (dernier mot du nom), lettres vides masquées, tri fr
// insensible aux accents. Filtré en direct par la recherche du hero (contexte).

/** Normalise pour comparaison/tri : sans accents, en capitales. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

/** Nom de famille = dernier mot du nom (pragmatique V1, modèle à champ unique). */
function lastNameToken(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Lettre de section : 1ʳᵉ lettre du nom de famille, ou « # » si non alphabétique. */
function sectionLetter(name: string): string {
  const c = fold(lastNameToken(name)).charAt(0);
  return c >= "A" && c <= "Z" ? c : "#";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ContactRow({ contact }: { contact: DirectoryContact }) {
  const sub = [contact.jobTitle, contact.company].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-3 border-b border-[#f1efeb] px-[18px] py-3.5 active:bg-(--surface-2)"
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

export function ContactsDirectory({
  contacts,
}: {
  contacts: DirectoryContact[];
}) {
  const { query } = useContactsSearch();

  const sections = useMemo(() => {
    const q = fold(query.trim());
    const filtered = q
      ? contacts.filter((c) =>
          fold(`${c.name} ${c.company ?? ""} ${c.jobTitle ?? ""}`).includes(q),
        )
      : contacts;

    const sorted = [...filtered].sort((a, b) => {
      const la = lastNameToken(a.name);
      const lb = lastNameToken(b.name);
      return (
        fold(la).localeCompare(fold(lb), "fr") ||
        a.name.localeCompare(b.name, "fr")
      );
    });

    const groups: { letter: string; items: DirectoryContact[] }[] = [];
    for (const c of sorted) {
      const letter = sectionLetter(c.name);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) last.items.push(c);
      else groups.push({ letter, items: [c] });
    }
    return groups;
  }, [contacts, query]);

  if (contacts.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun contact. Ajoutez-en un avec le bouton +.
      </p>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun contact pour « {query.trim()} ».
      </p>
    );
  }

  return (
    <div className="pt-1">
      {sections.map((section) => (
        <section key={section.letter}>
          <h2 className="sticky top-0 z-[1] bg-white px-[22px] pt-3 pb-1 text-[12.5px] font-extrabold text-relvo">
            {section.letter}
          </h2>
          {section.items.map((c) => (
            <ContactRow key={c.id} contact={c} />
          ))}
        </section>
      ))}
    </div>
  );
}
