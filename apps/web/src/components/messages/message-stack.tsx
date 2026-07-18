"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  ignoreMessageAction,
  loadMessageEventsAction,
} from "@/server/actions/messages";
import { SwipeToRemove } from "@/components/shared/swipe-to-remove";
import type { MessageRowData } from "@/lib/message-row";
import { initialsFor } from "@/lib/display";
import { cn } from "@/lib/utils";

// Pile « Sans sujet » (Direction B) — uniquement les messages que Relvo n'a pas
// classés. Tap → page détail (/messages/[id]) ; swipe-gauche → retirer. Non-lu =
// blanc + gras + pastille ; lu (= déjà ouvert) = grisé. Scroll infini (+50).

const CHANNEL: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
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

function MessageRow({
  data,
  onRemove,
}: {
  data: MessageRowData;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const unread = !data.read;

  function ignore() {
    startTransition(async () => {
      const res = await ignoreMessageAction(data.id);
      if (res.ok) {
        toast.success("Message retiré");
        onRemove(data.id);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <SwipeToRemove
      onRemove={ignore}
      onTap={() => router.push(`/messages/${data.id}`)}
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
          {initialsFor(data.senderName) ?? "E"}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {unread ? (
              <span className="size-2 flex-none rounded-full bg-brand" />
            ) : null}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px]",
                unread
                  ? "font-bold text-(--text-primary)"
                  : "font-semibold text-(--text-tertiary)",
              )}
            >
              {data.senderName}
            </span>
            <ChannelTag type={data.channelType} />
            <span className="flex-none text-[11.5px] text-(--text-tertiary)">
              {data.time}
            </span>
          </div>

          {data.subjectLine ? (
            <div
              className={cn(
                "mt-1 truncate text-[13.5px] font-semibold",
                unread ? "text-(--text-secondary)" : "text-(--text-tertiary)",
              )}
            >
              {data.subjectLine}
            </div>
          ) : null}

          <p
            className={cn(
              "mt-1 line-clamp-2 text-[13.5px] leading-[1.45]",
              unread ? "text-(--text-secondary)" : "text-(--text-tertiary)",
            )}
          >
            {data.preview}
          </p>
        </div>
      </div>
    </SwipeToRemove>
  );
}

export function MessageStack({
  initialItems,
  initialCursor,
}: {
  initialItems: MessageRowData[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((m) => m.id !== id)),
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    const res = await loadMessageEventsAction("orphan", cursor);
    if (res.ok) {
      setItems((prev) => [...prev, ...res.data.items]);
      setCursor(res.data.nextCursor);
    } else {
      toast.error(res.message);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [cursor]);

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

  if (items.length === 0) {
    return (
      <p className="px-[22px] py-12 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun message sans sujet. ✦<br />
        Relvo a tout classé.
      </p>
    );
  }

  return (
    <div>
      {items.map((m) => (
        <MessageRow key={m.id} data={m} onRemove={remove} />
      ))}
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
