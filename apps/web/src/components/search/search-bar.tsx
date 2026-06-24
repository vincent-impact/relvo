"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

// Barre de recherche globale (M9.13) — posée dans le hero violet de /recherche.
// Soumet vers /recherche?q=… (la page re-render les résultats côté serveur).
// Style verre translucide cohérent avec la recherche de Mon fil.

export function SearchBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(q: string) {
    const trimmed = q.trim();
    router.push(
      trimmed ? `/recherche?q=${encodeURIComponent(trimmed)}` : "/recherche",
    );
  }

  return (
    <div
      className="mx-[22px] mt-4 flex items-center gap-2.5 rounded-full px-[15px] py-2.5"
      style={{
        background: "rgb(255 255 255 / 0.16)",
        border: "1px solid rgb(255 255 255 / 0.24)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.16)",
      }}
    >
      <Search className="size-[18px] flex-none text-white/85" strokeWidth={2} />
      <input
        type="search"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(value);
        }}
        placeholder="Rechercher un sujet, un contact, un message…"
        className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-white outline-none placeholder:text-white/70 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Effacer"
          onClick={() => {
            setValue("");
            submit("");
          }}
          className="grid size-5 flex-none place-items-center rounded-full bg-white/20 text-white"
        >
          <X className="size-3" strokeWidth={2.6} />
        </button>
      ) : null}
    </div>
  );
}
