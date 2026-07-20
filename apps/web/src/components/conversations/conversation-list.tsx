"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  ignoreConversationAction,
  loadConversationsAction,
  reactivateConversationAction,
} from "@/server/actions/conversations";
import { SwipeToRemove } from "@/components/shared/swipe-to-remove";
import {
  CONVERSATION_FILTER_SLUGS,
  type ConversationFilterSlug,
  type ConversationRowData,
} from "@/lib/conversation-row";
import { initialsFor } from "@/lib/display";
import { cn } from "@/lib/utils";

// Liste /conversations (M6bis.8) — la surface de TRI, hors navigation, atteinte
// par le KPI « Sans sujet » de la page Sujets.
//
// Ne rend QUE les lignes : les filtres vivent dans l'URL et sont rendus par
// `ConversationFilters`, hors du <Suspense> de la liste. Changer de filtre est
// donc une NAVIGATION — la page remonte ce composant (clé), et l'état local
// (scroll infini, retraits optimistes) repart proprement du filtre affiché.
//
// Swipe gauche = Ignorer (rouge) — on écarte la SOURCE, pas le message. Dans le
// filtre « Ignorées », le même geste devient Réactiver (vert) : se dédire doit
// coûter exactement le même effort que faire taire.

const CHANNEL: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
};

// Vides HONNÊTES : « rien à trier » (le travail est fait) n'est pas « aucune
// conversation » (il n'y a rien du tout). Confondre les deux ferait croire à une
// perte de données le jour où l'ingestion tombe en panne.
const EMPTY: Record<ConversationFilterSlug, { title: string; hint: string }> = {
  "sans-sujet": {
    title: "Rien à trier ✦",
    hint: "Toutes vos conversations actives sont couvertes par un sujet.",
  },
  ignorees: {
    title: "Aucune conversation ignorée",
    hint: "Les sources que vous faites taire s'accumulent ici, et se réactivent d'un geste.",
  },
  toutes: {
    title: "Aucune conversation",
    hint: "Vos e-mails et messages WhatsApp apparaîtront ici dès leur arrivée.",
  },
};

function ChannelTag({ type }: { type: string }) {
  const c = CHANNEL[type] ?? { label: "Canal", icon: Mail };
  const Icon = c.icon;
  return (
    <span className="inline-flex flex-none items-center gap-1 text-[11.5px] font-semibold text-(--text-tertiary)">
      <Icon className="size-[14px]" strokeWidth={2} />
      {c.label}
    </span>
  );
}

function ConversationRow({
  data,
  filter,
  onRemove,
}: {
  data: ConversationRowData;
  filter: ConversationFilterSlug;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const unread = data.unreadCount > 0;
  // Dans « Ignorées », le geste rend la source au flux ; ailleurs il l'en sort.
  const reviving = filter === "ignorees";

  function swipe() {
    startTransition(async () => {
      const res = reviving
        ? await reactivateConversationAction(data.id)
        : await ignoreConversationAction(data.id);
      if (res.ok) {
        toast.success(
          reviving ? "Conversation réactivée" : "Conversation ignorée",
        );
        // Retrait optimiste : la ligne quitte le filtre courant dans les deux
        // sens (elle n'est plus ignorée / elle l'est devenue).
        onRemove(data.id);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <SwipeToRemove
      onRemove={swipe}
      onTap={() => router.push(`/conversations/${data.id}`)}
      label={reviving ? "Réactiver" : "Ignorer"}
      icon={reviving ? RotateCcw : EyeOff}
      tone={reviving ? "success" : "danger"}
    >
      <div
        className={cn(
          "flex gap-3 border-b border-[#f1efeb] px-[18px] py-3.5",
          unread ? "bg-white" : "bg-[#f7f6f3]",
        )}
      >
        <span
          className={cn(
            "grid size-[42px] flex-none place-items-center self-start rounded-full text-[14px] font-extrabold text-white",
            unread ? "bg-(--amber-600)" : "bg-[#c7c5bd]",
          )}
        >
          {initialsFor(data.title) ?? "?"}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px]",
                unread
                  ? "font-bold text-(--text-primary)"
                  : "font-semibold text-(--text-tertiary)",
              )}
            >
              {data.title}
            </span>
            <ChannelTag type={data.channelType} />
            <span className="flex-none text-[11.5px] text-(--text-tertiary)">
              {data.time}
            </span>
          </div>

          <div className="mt-1 flex items-end gap-2">
            <p
              className={cn(
                "line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-[1.45]",
                unread ? "text-(--text-secondary)" : "text-(--text-tertiary)",
              )}
            >
              {data.preview}
            </p>
            {/* Pastille de non-lus façon messagerie — le nombre, pas un point :
                sur une SOURCE, savoir « 14 » plutôt que « des messages » change
                la décision de l'ouvrir ou de l'ignorer. */}
            {unread ? (
              <span className="inline-flex h-[19px] min-w-[19px] flex-none items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-white">
                {data.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </SwipeToRemove>
  );
}

export function ConversationList({
  filter,
  initialItems,
  initialCursor,
}: {
  filter: ConversationFilterSlug;
  initialItems: ConversationRowData[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  // Une page suivante a-t-elle été chargée ? (cf. resynchronisation ci-dessous)
  const paged = useRef(false);

  // Le polling 30 s (PollRefresh) rejoue le rendu serveur : sans cela, un
  // message ARRIVÉ pendant qu'on trie n'apparaîtrait jamais, ce qui est
  // rédhibitoire sur une surface de tri. On ne resynchronise QUE tant qu'aucune
  // page suivante n'a été chargée — sinon le poll écraserait le scroll infini
  // et ferait « remonter » l'utilisateur sans qu'il ait rien demandé.
  useEffect(() => {
    if (paged.current) return;
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    const res = await loadConversationsAction(
      CONVERSATION_FILTER_SLUGS[filter],
      cursor,
    );
    if (res.ok) {
      paged.current = true;
      setItems((prev) => [...prev, ...res.data.items]);
      setCursor(res.data.nextCursor);
    } else {
      toast.error(res.message);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [cursor, filter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  const empty = EMPTY[filter];

  return (
    <div>
      {items.length === 0 ? (
        <div className="px-[22px] py-12 text-center">
          <p className="text-[14.5px] font-bold text-(--text-secondary)">
            {empty.title}
          </p>
          <p className="mt-1.5 text-[13px] text-(--text-tertiary)">
            {empty.hint}
          </p>
        </div>
      ) : (
        items.map((c) => (
          <ConversationRow
            key={c.id}
            data={c}
            filter={filter}
            onRemove={remove}
          />
        ))
      )}

      {cursor ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-5 text-(--text-tertiary)"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
