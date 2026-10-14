"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";
import { contactFullName, contactInitials } from "@/lib/display";

export type DirectoryContact = {
  id: string;
  firstName: string | null;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  status: string;
};

// Annuaire Contacts (M9.22) — façon répertoire téléphonique : sections par 1ʳᵉ
// lettre du NOM DE FAMILLE, lettres vides masquées, tri fr insensible aux
// accents. Filtré en direct par la recherche du hero (contexte partagé).

/** Normalise pour comparaison/tri : sans accents, en capitales. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

/** Lettre de section : 1ʳᵉ lettre du nom de famille, ou « # » si non alphabétique. */
function sectionLetter(lastName: string): string {
  const c = fold(lastName).charAt(0);
  return c >= "A" && c <= "Z" ? c : "#";
}

function ContactRow({ contact }: { contact: DirectoryContact }) {
  const sub = [contact.jobTitle, contact.company].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
    >
      <span className="chiffre grid size-10 flex-none place-items-center rounded-full bg-actor-ext-fond text-[14px] text-actor-ext">
        {contactInitials(contact)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] leading-[18px] font-normal text-noir">
          {contactFullName(contact)}
        </div>
        {sub ? (
          <div className="mt-0.5 truncate text-[12px] font-light text-gris">
            {sub}
          </div>
        ) : null}
      </div>
      {contact.status === "auto" ? (
        <span className="flex-none rounded-(--rayon-pilule) border border-(--attente) px-2.5 py-0.5 text-[11px] font-medium text-attente-texte">
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
          fold(
            `${c.firstName ?? ""} ${c.lastName} ${c.company ?? ""} ${c.jobTitle ?? ""}`,
          ).includes(q),
        )
      : contacts;

    const sorted = [...filtered].sort(
      (a, b) =>
        fold(a.lastName).localeCompare(fold(b.lastName), "fr") ||
        fold(a.firstName ?? "").localeCompare(fold(b.firstName ?? ""), "fr"),
    );

    const groups: { letter: string; items: DirectoryContact[] }[] = [];
    for (const c of sorted) {
      const letter = sectionLetter(c.lastName);
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
          <h2 className="domaine sticky top-0 z-1 bg-white px-3.5 pt-3 pb-1 text-gris">
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
