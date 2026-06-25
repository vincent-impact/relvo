import { Suspense } from "react";
import { Clock } from "lucide-react";
import { countOrphanMessages, listMessageEvents } from "@relvo/db";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MessageStack } from "@/components/messages/message-stack";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { MESSAGES_PAGE_SIZE, toMessageRowData } from "@/lib/message-row";
import { getTenantDb } from "@/server/auth-context";

// Messages (M9.9, Direction B) — UNIQUEMENT les messages « Sans sujet ». Relvo
// n'est pas une boîte mail : les messages classés vivent dans leur sujet (seule
// surface d'interaction, invariant n°4). Cette pile se vide au tri ; un orphelin
// non rattaché est conservé 15 jours puis retiré automatiquement. Action de tri
// principale : « Créer un sujet » depuis un message.
//
// PERF (M9.19, point 2) : le hero (compteur) + la note s'affichent
// instantanément ; la pile stream dans un <Suspense>.

async function OrphanStack() {
  const db = await getTenantDb();
  const orphanPage = await listMessageEvents(db, {
    filter: "orphan",
    limit: MESSAGES_PAGE_SIZE,
  });
  const items = orphanPage.items.map(toMessageRowData);
  return (
    <MessageStack initialItems={items} initialCursor={orphanPage.nextCursor} />
  );
}

export default async function MessagesPage() {
  const db = await getTenantDb();
  const orphanTotal = await countOrphanMessages(db);

  return (
    <Screen>
      <RelvoHeader
        back="/fil"
        title="Messages sans sujet"
        subtitle={
          orphanTotal > 0
            ? `${orphanTotal} message${orphanTotal > 1 ? "s" : ""} à trier`
            : "Tout est classé"
        }
        className="pb-9"
      />

      <div className="mx-4 mt-4 mb-1 flex items-start gap-2.5 rounded-2xl border border-(--border-light) bg-(--surface) px-3.5 py-3">
        <Clock
          className="mt-px size-4 flex-none text-(--text-tertiary)"
          strokeWidth={2}
        />
        <p className="text-[12.5px] leading-[1.45] text-(--text-tertiary)">
          Les messages qui ne sont rattachés à aucun sujet sont conservés{" "}
          <b className="font-bold text-(--text-secondary)">15 jours</b>, puis
          automatiquement retirés de Relvo.
        </p>
      </div>

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <OrphanStack />
      </Suspense>
    </Screen>
  );
}
