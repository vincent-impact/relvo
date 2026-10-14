"use client";

import { useRouter } from "next/navigation";
import { type Picto, Envelope, WhatsappLogo } from "@/components/shared/picto";
import type { ConversationBadges } from "@relvo/db";
import { IndicatorTabs } from "@/components/shared/indicator-tabs";
import type {
  ConversationChannelSlug,
  ConversationFilterSlug,
} from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// Filtres de /conversations. DEUX niveaux, tous deux portés par l'URL :
//   1. « qu'est-ce que je regarde » — À trier / Suivies / Ignorées : la carte
//      d'INDICATEURS qui chevauche le ciel, l'actif cerclé (IndicatorTabs).
//   2. le CANAL — Tous / E-mail / WhatsApp : une rangée de puces, l'active
//      noire pleine, comme les domaines de Sujets.
//
// L'URL est la source de vérité : la page reste linkable et c'est la base qui
// filtre. Les deux contrôles se PRÉSERVENT l'un l'autre dans le lien construit.
// Rendu HORS du <Suspense> de la liste → ils s'affichent immédiatement.
//
// LES COMPTEURS (M7, tranche 4) — « ce qui t'attend ici », une seule règle de
// lecture pour trois chiffres de nature différente :
//   · À trier : un STOCK, le résidu de Relvo — toutes les conversations à trier,
//     lues ou non. Le chiffre ne tombe qu'en triant à la main.
//   · Suivies, Ignorées : un FLUX — ce que Relvo y a rangé depuis le dernier
//     passage. Le chiffre tombe quand l'onglet est vu ; sur l'onglet actif il
//     n'est donc jamais affiché (la page marque le passage en rendant).

const CHANNEL_OPTIONS: {
  value: ConversationChannelSlug;
  label: string;
  icon: Picto | null;
}[] = [
  { value: "tous", label: "Tous", icon: null },
  { value: "email", label: "E-mail", icon: Envelope },
  { value: "whatsapp", label: "WhatsApp", icon: WhatsappLogo },
];

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

  // Un flux déjà vu (onglet actif) n'affiche pas de chiffre ; le stock, toujours.
  const flux = (slug: ConversationFilterSlug, n: number) =>
    slug === filter ? undefined : n;

  return (
    <>
      <IndicatorTabs<ConversationFilterSlug>
        value={filter}
        onChange={(v) => go({ filter: v })}
        tabs={[
          { key: "sans-sujet", label: "à trier", count: badges.unsorted },
          {
            key: "suivies",
            label: "suivies",
            count: flux("suivies", badges.followed),
          },
          {
            key: "ignorees",
            label: "ignorées",
            count: flux("ignorees", badges.ignored),
          },
        ]}
      />

      <div
        role="group"
        aria-label="Canal"
        className="flex gap-2 px-4 pt-3 pb-0.5"
      >
        {CHANNEL_OPTIONS.map((opt) => {
          const active = opt.value === channel;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => go({ channel: opt.value })}
              aria-pressed={active}
              className={cn(
                "pressable inline-flex h-7 items-center gap-1.5 rounded-(--rayon-pilule) border px-3 text-[12px] whitespace-nowrap transition-colors",
                active
                  ? "border-noir bg-noir font-medium text-white"
                  : "border-(--filet) bg-white font-normal text-noir",
              )}
            >
              {Icon ? <Icon className="size-3.5 flex-none" /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
