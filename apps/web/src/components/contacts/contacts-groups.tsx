"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useContactsSearch } from "@/components/contacts/contacts-search-context";

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
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun groupe. Les groupes WhatsApp apparaissent ici dès leur premier
        message.
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun groupe pour « {query.trim()} ».
      </p>
    );
  }

  return (
    <div className="pt-1">
      {filtered.map((g) => (
        <Link
          key={g.id}
          href={`/conversations/${g.id}`}
          className="flex items-center gap-3 border-b border-[#f1efeb] px-[18px] py-3.5 active:bg-(--surface-2)"
        >
          <span className="grid size-[42px] flex-none place-items-center rounded-full bg-(--green-600) text-white">
            <Users className="size-[20px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-bold">{g.title}</div>
            <div className="mt-0.5 truncate text-[13px] text-[#86857d]">
              Groupe WhatsApp
            </div>
          </div>
          {g.time ? (
            <span className="flex-none text-[11.5px] text-(--text-tertiary)">
              {g.time}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
