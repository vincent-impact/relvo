"use client";

import { useRouter } from "next/navigation";
import { SegTabs } from "@/components/shared/seg-tabs";
import type { ConversationFilterSlug } from "@/lib/conversation-row";

// Filtres de /conversations (M6bis.8). UN SEUL niveau : « qu'est-ce que je
// regarde » (Sans sujet / Ignorées / Toutes) → SegTabs, à cheval sur le hero,
// comme les onglets de page ailleurs dans l'app.
//
// Le filtre CANAL (email/WhatsApp) a été RETIRÉ (2026-07-20, retour de prod) :
// il occupait une ligne entière sous les onglets pour un besoin qui ne se
// présente pas — on trie par conversation, pas par tuyau, et le canal est déjà
// lisible sur chaque ligne (ChannelTag). Sur une surface de tri mobile-first,
// une rangée de contrôles qu'on ne touche jamais coûte plus qu'elle ne rapporte.
// L'option `channelType` reste disponible côté domaine (cf. `conversations.ts`).
//
// Le filtre vit dans l'URL : la page reste linkable (le KPI « Sans sujet »
// pointe droit sur `?filtre=sans-sujet`) et c'est la base qui filtre. Le
// composant est donc rendu HORS du <Suspense> de la liste : les filtres
// s'affichent immédiatement, seule la liste attend la base.

const FILTER_OPTIONS: { value: ConversationFilterSlug; label: string }[] = [
  { value: "sans-sujet", label: "Sans sujet" },
  { value: "ignorees", label: "Ignorées" },
  { value: "toutes", label: "Toutes" },
];

export function ConversationFilters({
  filter,
}: {
  filter: ConversationFilterSlug;
}) {
  const router = useRouter();

  return (
    <SegTabs
      options={FILTER_OPTIONS}
      value={filter}
      onValueChange={(v) => router.push(`/conversations?filtre=${v}`)}
      overlap
    />
  );
}
