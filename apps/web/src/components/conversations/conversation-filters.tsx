"use client";

import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { SegTabs } from "@/components/shared/seg-tabs";
import type {
  ConversationChannelSlug,
  ConversationFilterSlug,
} from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// Filtres de /conversations. DEUX niveaux, tous deux portés par l'URL :
//   1. « qu'est-ce que je regarde » — Sans sujet / Ignorées / Toutes (SegTabs, à
//      cheval sur le hero).
//   2. le CANAL — Tous / E-mail / WhatsApp (rangée de chips légères, 2026-07-24) :
//      isoler un tuyau quand il sature le flux. « tous » ne contraint rien.
//
// L'URL est la source de vérité : la page reste linkable (le KPI « Sans sujet »
// pointe droit sur `?filtre=sans-sujet`) et c'est la base qui filtre. Les deux
// contrôles se PRÉSERVENT l'un l'autre dans le lien construit. Rendu HORS du
// <Suspense> de la liste → ils s'affichent immédiatement.

const FILTER_OPTIONS: { value: ConversationFilterSlug; label: string }[] = [
  { value: "sans-sujet", label: "Sans sujet" },
  { value: "suivies", label: "Suivies" },
  { value: "ignorees", label: "Ignorées" },
];

const CHANNEL_OPTIONS: {
  value: ConversationChannelSlug;
  label: string;
  icon: typeof Mail | null;
}[] = [
  { value: "tous", label: "Tous", icon: null },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function ConversationFilters({
  filter,
  channel,
}: {
  filter: ConversationFilterSlug;
  channel: ConversationChannelSlug;
}) {
  const router = useRouter();

  function go(next: {
    filter?: ConversationFilterSlug;
    channel?: ConversationChannelSlug;
  }) {
    const f = next.filter ?? filter;
    const c = next.channel ?? channel;
    const params = new URLSearchParams({ filtre: f });
    if (c !== "tous") params.set("canal", c);
    router.push(`/conversations?${params.toString()}`);
  }

  return (
    <>
      <SegTabs
        options={FILTER_OPTIONS}
        value={filter}
        onValueChange={(v) => go({ filter: v as ConversationFilterSlug })}
        overlap
      />

      {/* Filtre canal — chips discrètes, sous les onglets. */}
      <div className="flex gap-1.5 px-4 pt-3">
        {CHANNEL_OPTIONS.map((opt) => {
          const active = opt.value === channel;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => go({ channel: opt.value })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-transparent bg-relvo text-white"
                  : "border-(--border) bg-white text-(--text-secondary)",
              )}
            >
              {Icon ? (
                <Icon className="size-[14px] flex-none" strokeWidth={2.2} />
              ) : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
