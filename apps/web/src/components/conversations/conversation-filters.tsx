"use client";

import { useRouter } from "next/navigation";
import { SegTabs } from "@/components/shared/seg-tabs";
import { SegmentedControl } from "@/components/shared/segmented-control";
import type { ConversationFilterSlug } from "@/lib/conversation-row";

// Filtres de /conversations (M6bis.8). Deux niveaux, volontairement distincts :
//   - le filtre PRINCIPAL (Sans sujet / Ignorées / Toutes) répond à « qu'est-ce
//     que je regarde » → SegTabs, à cheval sur le hero, comme les onglets de
//     page ailleurs dans l'app ;
//   - le filtre CANAL est un raffinement → segmented discret, sous les onglets.
//
// Les deux vivent dans l'URL : la page reste linkable (le KPI « Sans sujet »
// pointe droit sur `?filtre=sans-sujet`) et c'est la base qui filtre. Le
// composant est donc rendu HORS du <Suspense> de la liste : les filtres
// s'affichent immédiatement, seule la liste attend la base.

const FILTER_OPTIONS: { value: ConversationFilterSlug; label: string }[] = [
  { value: "sans-sujet", label: "Sans sujet" },
  { value: "ignorees", label: "Ignorées" },
  { value: "toutes", label: "Toutes" },
];

const CHANNEL_OPTIONS = [
  { value: "tous", label: "Tous les canaux" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export function ConversationFilters({
  filter,
  channel,
}: {
  filter: ConversationFilterSlug;
  channel: "email" | "whatsapp" | null;
}) {
  const router = useRouter();

  function navigate(next: { filtre?: string; canal?: string | null }) {
    const params = new URLSearchParams();
    params.set("filtre", next.filtre ?? filter);
    const canal = next.canal === undefined ? channel : next.canal;
    if (canal) params.set("canal", canal);
    router.push(`/conversations?${params.toString()}`);
  }

  return (
    <>
      <SegTabs
        options={FILTER_OPTIONS}
        value={filter}
        onValueChange={(v) => navigate({ filtre: v })}
        overlap
      />
      <div className="px-4 pt-3.5 pb-1">
        <SegmentedControl
          options={CHANNEL_OPTIONS}
          value={channel ?? "tous"}
          onValueChange={(v) => navigate({ canal: v === "tous" ? null : v })}
        />
      </div>
    </>
  );
}
