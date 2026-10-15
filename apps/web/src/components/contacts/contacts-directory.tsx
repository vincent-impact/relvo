"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";
import { ListPanel } from "@/components/shared/list-panel";
import {
  RELVO_LINK,
  RelvoBlock,
  RelvoSentence,
} from "@/components/shared/relvo-block";
import { ContactAvatarIcon } from "@/components/contacts/contact-avatar-icon";
import { guessContactKind } from "@/lib/contact-avatar";
import { contactFullName, initialsFor } from "@/lib/display";

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
//
// Une liste = UNE carte (design-system/02-composants) : les lettres sont des
// lignes d'en-tête enfoncées dans le même `ListPanel` que les contacts, pas des
// titres posés sur le fond. Elles ne sont pas collantes : le panneau rogne ses
// coins (`overflow: hidden`), et vingt contacts n'ont pas besoin d'un index.

/** Normalise pour comparaison/tri : sans accents, en capitales. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

/** Lettre de section : 1ʳᵉ lettre du nom AFFICHÉ, ou « # » si non alphabétique.
 *  La lettre suit ce que l'œil lit (« Karim Benali » sous K) : trier par nom
 *  de famille en affichant le prénom d'abord contredisait la lettre. */
function sectionLetter(shown: string): string {
  const c = fold(shown).charAt(0);
  return c >= "A" && c <= "Z" ? c : "#";
}

function ContactRow({ contact }: { contact: DirectoryContact }) {
  const name = contactFullName(contact);
  // L'entreprise ne se redit pas quand le contact EST l'entreprise.
  const company =
    contact.company && contact.company.trim() !== name.trim()
      ? contact.company
      : null;
  const sub = [contact.jobTitle, company].filter(Boolean).join(" · ");
  const initials = initialsFor(name);
  return (
    <Link
      href={`/contacts/${contact.id}`}
      data-list-row
      className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
    >
      <span className="chiffre grid size-10 flex-none place-items-center rounded-full bg-actor-ext-fond text-[14px] text-actor-ext">
        {initials ?? (
          <ContactAvatarIcon
            kind={guessContactKind({ name })}
            className="size-[18px]"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] leading-[18px] font-normal text-noir">
          {name}
        </div>
        {sub ? (
          <div className="mt-0.5 truncate text-[12px] font-normal text-gris">
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
  hasChannels = true,
}: {
  contacts: DirectoryContact[];
  /** Aucune boîte reliée : l'état vide mène à Canaux. */
  hasChannels?: boolean;
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

    const sorted = [...filtered].sort((a, b) =>
      fold(contactFullName(a)).localeCompare(fold(contactFullName(b)), "fr"),
    );

    const groups: { letter: string; items: DirectoryContact[] }[] = [];
    for (const c of sorted) {
      const letter = sectionLetter(contactFullName(c));
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) last.items.push(c);
      else groups.push({ letter, items: [c] });
    }
    return groups;
  }, [contacts, query]);

  if (contacts.length === 0) {
    // L'annuaire se remplit tout seul : Relvo le dit, et dit par où
    // commencer quand rien n'est arrivé. Le « + » reste la porte de l'utilisateur.
    return (
      <RelvoBlock className="mx-4 mt-1">
        <RelvoSentence>
          {hasChannels
            ? "Je remplis l’annuaire à mesure que je lis votre courrier : chaque personne qui vous écrit devient un contact, avec son entreprise et son rôle. Vous pouvez aussi en ajouter un avec le +."
            : "L’annuaire se remplit tout seul à partir de votre courrier. Reliez la boîte où arrivent vos fournisseurs et vos clients, et chaque personne qui vous écrit apparaîtra ici."}
        </RelvoSentence>
        {!hasChannels ? (
          <Link href="/canaux" className={RELVO_LINK}>
            → Relier ma boîte e-mail
          </Link>
        ) : null}
      </RelvoBlock>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
        Aucun contact pour « {query.trim()} ».
      </p>
    );
  }

  return (
    <ListPanel className="mt-1">
      {sections.flatMap((section) => [
        <div
          key={`lettre-${section.letter}`}
          data-list-row
          className="domaine border-b border-(--filet) bg-(--fond-enfonce) px-3.5 py-1.5 text-gris"
        >
          {section.letter}
        </div>,
        ...section.items.map((c) => <ContactRow key={c.id} contact={c} />),
      ])}
    </ListPanel>
  );
}
