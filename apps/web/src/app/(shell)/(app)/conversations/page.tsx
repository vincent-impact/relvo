import { Suspense } from "react";
import { countUnsortedConversations, listConversationItems } from "@relvo/db";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { ConversationFilters } from "@/components/conversations/conversation-filters";
import { ConversationList } from "@/components/conversations/conversation-list";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import {
  CONVERSATIONS_PAGE_SIZE,
  CONVERSATION_CHANNEL_SLUGS,
  CONVERSATION_FILTER_SLUGS,
  type ConversationChannelSlug,
  type ConversationFilterSlug,
  parseChannelSlug,
  parseFilterSlug,
  toConversationRowData,
} from "@/lib/conversation-row";
import { getTenantDb } from "@/server/auth-context";

// Conversations (M6bis.8) — la surface de TRI, hors navigation : on y arrive par
// le KPI « Sans sujet » de la page Sujets. Elle remplace à terme `/messages`,
// qui raisonnait en MESSAGES orphelins alors que le tri se décide désormais par
// CONVERSATION (déterministe, calculé à la réception).
//
// Le filtre vit dans l'URL (`?filtre=…`) : la page est linkable, et c'est la
// BASE qui filtre — jamais un tri côté navigateur sur une liste tronquée par la
// pagination. Le second filtre `?canal=` (email/WhatsApp) a été retiré le
// 2026-07-20 : cf. `conversation-filters.tsx`.
//
// PERF (M9.19) : le hero (compteur) s'affiche instantanément ; la liste stream
// dans un <Suspense>.

async function List({
  filter,
  channel,
}: {
  filter: ConversationFilterSlug;
  channel: ConversationChannelSlug;
}) {
  const db = await getTenantDb();
  const page = await listConversationItems(db, {
    filter: CONVERSATION_FILTER_SLUGS[filter],
    channelType: CONVERSATION_CHANNEL_SLUGS[channel],
    limit: CONVERSATIONS_PAGE_SIZE,
  });
  return (
    <ConversationList
      // La clé force un remontage à chaque changement de filtre/canal : l'état
      // local (scroll infini, retraits optimistes) appartient à la vue affichée.
      key={`${filter}:${channel}`}
      filter={filter}
      channel={channel}
      initialItems={page.items.map(toConversationRowData)}
      initialCursor={page.nextCursor}
    />
  );
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; canal?: string }>;
}) {
  const { filtre, canal } = await searchParams;
  const filter = parseFilterSlug(filtre);
  const channel = parseChannelSlug(canal);

  const db = await getTenantDb();
  const unsorted = await countUnsortedConversations(db);

  return (
    <Screen>
      <PollRefresh />
      <RelvoHeader
        back="/fil"
        title="Conversations"
        subtitle={
          unsorted > 0
            ? `${unsorted} conversation${unsorted > 1 ? "s" : ""} à trier`
            : "Tout est couvert par un sujet"
        }
        className="pb-[46px]"
      />

      <ConversationFilters filter={filter} channel={channel} />

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <List filter={filter} channel={channel} />
      </Suspense>
    </Screen>
  );
}
