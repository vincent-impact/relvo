import { Suspense } from "react";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { countUnsortedMessages, listMessageEvents } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MessageStack } from "@/components/messages/message-stack";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { MESSAGES_PAGE_SIZE, toMessageRowData } from "@/lib/message-row";
import { getTenantDb } from "@/server/auth-context";

// Messages (M9.9, Direction B) — UNIQUEMENT les messages « Sans sujet ». Relvo
// n'est pas une boîte mail : les messages classés vivent dans leur sujet (seule
// surface d'interaction, invariant n°4). Cette pile se vide au tri ; action de
// tri principale : « Créer un sujet » depuis un message.
//
// ⚠️ TRANSITOIRE (M6bis) — cette page raisonne encore en MESSAGES, alors que le
// tri se fait désormais par CONVERSATION. Sa remplaçante est `/conversations` ;
// en attendant, son compteur reste le reflet exact de la pile affichée (des
// messages), et NON le KPI « Sans sujet » de la page Sujets (des conversations).
//
// PERF (M9.19, point 2) : le hero (compteur) s'affiche instantanément ; la pile
// stream dans un <Suspense>.

async function UnsortedStack() {
  const db = await getTenantDb();
  const page = await listMessageEvents(db, {
    filter: "unsorted",
    limit: MESSAGES_PAGE_SIZE,
  });
  const items = page.items.map(toMessageRowData);
  return <MessageStack initialItems={items} initialCursor={page.nextCursor} />;
}

export default async function MessagesPage() {
  const db = await getTenantDb();
  const unsortedTotal = await countUnsortedMessages(db);

  return (
    <Screen>
      <PollRefresh />
      <RelvoHeader
        back="/fil"
        title="Messages sans sujet"
        subtitle={
          unsortedTotal > 0
            ? `${unsortedTotal} message${unsortedTotal > 1 ? "s" : ""} à trier`
            : "Tout est classé"
        }
        className="pb-9"
      />

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <UnsortedStack />
      </Suspense>
    </Screen>
  );
}
