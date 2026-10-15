"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users } from "@/components/shared/picto";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";
import { ListPanel } from "@/components/shared/list-panel";

// Onglet « Groupes » de l'annuaire (2026-07-24). Un groupe n'est PAS un Contact :
// c'est une conversation WhatsApp de type `whatsapp_group` (il est son propre
// interlocuteur). On liste donc les groupes ici, et chaque ligne mène droit à la
// conversation du groupe. Filtré en direct par la recherche du hero (contexte
// partagé, comme l'annuaire des contacts).

export type DirectoryGroup = {
  id: string;
  title: string;
  /** Dernière activité, préformatée côté serveur. */
  time: string;
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

export function ContactsGroups({ groups }: { groups: DirectoryGroup[] }) {
  const { query } = useContactsSearch();

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? groups.filter((g) => fold(g.title).includes(q)) : groups;
  }, [groups, query]);

  if (groups.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
        Aucun groupe. Les groupes WhatsApp apparaissent ici dès leur premier
        message.
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
        Aucun groupe pour « {query.trim()} ».
      </p>
    );
  }

  // La même ligne que l'annuaire : un groupe est un tiers (ambre Externe), le
  // pictogramme dit « groupe », l'onglet dit déjà « WhatsApp ».
  return (
    <ListPanel className="mt-1">
      {filtered.map((g) => (
        <Link
          key={g.id}
          data-list-row
          href={`/conversations/${g.id}?from=${encodeURIComponent("/contacts?tab=groupes")}`}
          className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
        >
          <span className="grid size-10 flex-none place-items-center rounded-full bg-actor-ext-fond text-actor-ext">
            <Users className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] leading-[18px] font-normal text-noir">
            {g.title}
          </span>
          {g.time ? (
            <span className="chiffre flex-none text-[13px] text-gris">
              {g.time}
            </span>
          ) : null}
        </Link>
      ))}
    </ListPanel>
  );
}
