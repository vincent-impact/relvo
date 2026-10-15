import Link from "next/link";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import type { CachedNews } from "@/server/cached";
import type { BriefSuggestion } from "@relvo/db";

// « Dernières nouvelles » — la première zone du brief (01 §11, invariant 34) :
// le BLOC DE RELVO (design-system/01-tokens, « un bloc violet pâle signé des
// étoiles, c'est Relvo qui parle »), posé dans le ciel qui fond derrière lui.
// Un résumé CALCULÉ depuis le dernier passage et AU PLUS DEUX suggestions par
// règles. Une question de Relvo est une ligne avec son bouton « Répondre » ;
// une autre suggestion est un lien fléché. Chaque phrase pointe sa preuve :
// c'est le lien qui ouvre l'échange avec elle comme premier tour. Jamais de
// raccourcis vers les sujets : ils finiraient par saturer.
//
// Le bloc n'est signé que « Relvo », sans horodatage : la phrase porte déjà sa
// fenêtre (« depuis votre dernière visite »), et un tampon « à l'instant » qui
// daterait la dernière VISITE se lirait comme l'heure de la prise de parole.

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
  // « de mon côté » : la phrase compte ce que Relvo a FAIT, pas l'état du
  // compte — sans ça, suivie de « 88 tâches en retard », elle se contredit.
  if (parts.length === 0) {
    return news.since
      ? "Rien de nouveau de mon côté depuis votre dernière visite."
      : "Je n'ai encore rien lu : connectez un canal pour que je commence.";
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
  return `${origin}, j'ai ${list}.`;
}

function suggestionHref(s: BriefSuggestion): string {
  return `/relvo?from=%2F&q=${encodeURIComponent(s.text)}`;
}

export function NewsPanel({
  news,
  suggestions,
}: {
  news: CachedNews;
  suggestions: BriefSuggestion[];
}) {
  const questions = suggestions.filter((s) => s.kind === "question");
  const others = suggestions.filter((s) => s.kind !== "question");
  return (
    <section
      aria-label="Dernières nouvelles"
      className="rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale px-3.5 pt-3 pb-2 text-noir shadow-carte"
    >
      <div className="flex items-center gap-2">
        <RelvoLogo
          size={22}
          variant="full"
          className="text-relvo-clair"
          title=""
        />
        <span className="libelle text-relvo!">Relvo</span>
      </div>
      <p className="mt-1.5 text-[14px] leading-5 font-light">
        {newsSentence(news)}
      </p>
      {/* Un lien fléché : retrait suspendu (la seconde ligne s'aligne sous le
          texte, pas sous la flèche) et une hauteur de frappe qui tient au pouce. */}
      {others.map((s, i) => (
        <Link
          key={`${s.kind}-${i}`}
          href={suggestionHref(s)}
          className="mt-0.5 block py-1.5 pl-[1.1em] -indent-[1.1em] text-[14px] leading-[18px] font-medium text-relvo active:opacity-80"
        >
          → {s.text}
        </Link>
      ))}
      {questions.map((s, i) => (
        <div
          key={`${s.kind}-${i}`}
          className="mt-2 flex items-center justify-between gap-2.5 border-t border-relvo-filet pt-2 pb-1"
        >
          <span className="min-w-0 flex-1 text-[14px] leading-[18px]">
            {s.text}
          </span>
          <Link
            href={suggestionHref(s)}
            className="pressable h-[30px] flex-none rounded-(--rayon-pilule) px-3.5 text-[12px] leading-[30px] font-medium text-white"
            style={{ background: "var(--degrade-relvo)" }}
          >
            Répondre
          </Link>
        </div>
      ))}
    </section>
  );
}
