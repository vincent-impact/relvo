"use client";

import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import type { ConversationBadges } from "@relvo/db";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";
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
//
// LES PASTILLES (M7, tranche 4) — « ce qui t'attend ici », une seule règle de
// lecture pour trois chiffres de nature différente :
//   · Sans sujet : un STOCK, le résidu de Relvo — toutes les conversations à
//     trier, lues ou non. Le chiffre ne tombe qu'en triant à la main.
//   · Suivies, Ignorées : un FLUX — ce que Relvo y a rangé depuis le dernier
//     passage. Le chiffre tombe quand l'onglet est vu ; sur l'onglet actif il
//     n'est donc jamais affiché (la page marque le passage en rendant).
// Volontairement hétérogène : c'est ce qui dit à l'utilisateur que le premier
// chiffre réclame un geste et que les deux autres ne réclament qu'un regard.
// Une seule couleur, la violette de Relvo : l'onglet porte déjà le sens.

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

function withBadges(
  badges: ConversationBadges,
  active: ConversationFilterSlug,
): SegTabOption[] {
  const count = (slug: ConversationFilterSlug, n: number) =>
    n > 0 && (slug === "sans-sujet" || slug !== active) ? n : undefined;
  return FILTER_OPTIONS.map((opt) => ({
    ...opt,
    count: count(
      opt.value,
      opt.value === "sans-sujet"
        ? badges.unsorted
        : opt.value === "suivies"
          ? badges.followed
          : badges.ignored,
    ),
    countTone: "relvo",
  }));
}

export function ConversationFilters({
  filter,
  channel,
  badges,
}: {
  filter: ConversationFilterSlug;
  channel: ConversationChannelSlug;
  badges: ConversationBadges;
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
        options={withBadges(badges, filter)}
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
                "pressable inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-colors",
                active
                  ? "border-transparent bg-relvo text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(20_18_40/0.18)]"
                  : "border-(--hairline) bg-white text-(--text-secondary) shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(20_18_40/0.05)]",
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
