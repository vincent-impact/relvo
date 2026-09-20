import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { formatRelative } from "@/lib/display";
import type { CachedNews } from "@/server/cached";
import type { BriefSuggestion } from "@relvo/db";

// « Dernières nouvelles » — la première zone du brief (01 §11, invariant 34),
// dans le header, dans la voix de Relvo, sur un panneau translucide. Un résumé
// CALCULÉ depuis le dernier passage et AU PLUS DEUX suggestions par règles, qui
// ouvrent l'échange avec leur phrase comme premier tour. Jamais de raccourcis
// vers les sujets : ils finiraient par saturer. Le titre est « Dernières
// nouvelles », jamais « Relvo vous parle ».

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** La phrase du résumé, composée depuis les compteurs — jamais générée. */
export function newsSentence(news: CachedNews): string {
  const parts: string[] = [];
  if (news.messagesRead > 0)
    parts.push(`lu ${plural(news.messagesRead, "message", "messages")}`);
  if (news.subjectsOpened > 0)
    parts.push(`ouvert ${plural(news.subjectsOpened, "sujet", "sujets")}`);
  if (news.tasksProposed > 0)
    parts.push(`proposé ${plural(news.tasksProposed, "tâche", "tâches")}`);
  if (news.draftsPrepared > 0)
    parts.push(
      `préparé ${plural(news.draftsPrepared, "brouillon", "brouillons")}`,
    );
  if (news.conversationsMuted > 0)
    parts.push(
      `mis ${plural(news.conversationsMuted, "conversation", "conversations")} en sourdine`,
    );

  const origin = news.since
    ? "Depuis votre dernière visite"
    : "Depuis la connexion de vos canaux";
  if (parts.length === 0) {
    return news.since
      ? "Rien de nouveau depuis votre dernière visite."
      : "Je n'ai encore rien lu : connectez un canal pour que je commence.";
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
  return `${origin}, j'ai ${list}.`;
}

export function NewsPanel({
  news,
  suggestions,
}: {
  news: CachedNews;
  suggestions: BriefSuggestion[];
}) {
  const stamp = news.since ? formatRelative(new Date(news.since)) : null;
  return (
    <div
      className="mx-3 mt-3.5 rounded-[14px] px-3.5 pt-3 pb-1"
      style={{
        background: "rgb(255 255 255 / 0.12)",
        border: "1px solid rgb(255 255 255 / 0.24)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.18)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[11px] font-semibold tracking-[0.06em] text-white uppercase">
          <RelvoLogo
            size={18}
            variant="inverted"
            className="text-relvo"
            title=""
          />
          Dernières nouvelles
        </span>
        {stamp ? (
          <span className="text-[11.5px] text-(--on-violet)">{stamp}</span>
        ) : null}
      </div>
      <p className="mb-1.5 text-[14.5px] leading-[1.4] text-white">
        {newsSentence(news)}
      </p>
      {suggestions.map((s) => (
        <Link
          key={s.text}
          href={`/relvo?from=%2F&q=${encodeURIComponent(s.text)}`}
          className="flex items-center gap-2.5 border-t border-white/18 py-2.5 text-[14px] leading-[1.3] text-white active:opacity-80"
        >
          {s.kind === "question" ? (
            <span className="flex-none rounded-full bg-[#fafafa] px-[7px] py-[3px] text-[10.5px] font-semibold tracking-[0.04em] text-relvo uppercase">
              Question
            </span>
          ) : null}
          <span className="min-w-0 flex-1">{s.text}</span>
          <ChevronRight
            className="size-4 flex-none text-white/70"
            strokeWidth={2}
          />
        </Link>
      ))}
    </div>
  );
}
