import Link from "next/link";
import { LienNotifications } from "@/components/home/lien-notifications";
import {
  RELVO_LINK,
  RelvoBlock,
  RelvoSentence,
} from "@/components/shared/relvo-block";
import {
  type CarteVivanteData,
  PointsQuiRespirent,
  phraseLecture,
} from "@/components/shared/carte-vivante";
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
export function newsSentence(news: CachedNews, hasChannels = true): string {
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
    // Sans boîte reliée, rien n'est encore arrivé : Relvo le dit et GUIDE vers
    // la première adresse (01 §11, M19.9) — c'est le pas qui suit les
    // diapositives. Avec une boîte, la lecture est en cours : elle se suit
    // dans l'échange (M7.19).
    if (!hasChannels)
      return "Je n’ai encore rien à lire. Reliez la boîte où arrivent vos fournisseurs et vos clients : je lis le courrier des dernières semaines et j’ouvre vos premiers sujets.";
    return news.since
      ? "Rien de nouveau de mon côté depuis votre dernière visite."
      : "Je lis le courrier des deux dernières semaines : vos premiers sujets arrivent au fil de la lecture.";
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
  return `${origin}, j'ai ${list}.`;
}

function suggestionHref(s: BriefSuggestion): string {
  // Une question de Relvo se répond dans l'échange, en formulaire (05 §11.12) ;
  // une suggestion par règles y entre comme premier tour, à envoyer.
  if (s.kind === "question" || s.kind === "lecture") return "/relvo?from=%2F";
  return `/relvo?from=%2F&q=${encodeURIComponent(s.text)}`;
}

/** Les compteurs de la lecture, en une ligne — rien tant qu'il n'y a rien à compter. */
function compteursLecture(l: CarteVivanteData): string | null {
  if (l.messagesImported === 0 && l.subjectsOpened === 0) return null;
  const lus = `${l.messagesImported} message${l.messagesImported > 1 ? "s" : ""} lu${l.messagesImported > 1 ? "s" : ""}`;
  const ouvertes = `${l.subjectsOpened} sujet${l.subjectsOpened > 1 ? "s" : ""} ouvert${l.subjectsOpened > 1 ? "s" : ""}`;
  return `${lus}, ${ouvertes}`;
}

export function NewsPanel({
  news,
  suggestions,
  hasChannels = true,
  lecture = null,
  clePublique = null,
}: {
  news: CachedNews;
  suggestions: BriefSuggestion[];
  /** La clé publique VAPID : la ligne « Activer les notifications » tant que cet appareil n'est pas abonné. */
  clePublique?: string | null;
  /** Aucune boîte reliée : le bloc guide vers Canaux au lieu de résumer. */
  hasChannels?: boolean;
  /** Relvo lit le courrier EN CE MOMENT (lu en direct, jamais du cache) : le
   * bloc le dit en premier, avec ses compteurs, et mène à l'échange où la
   * lecture se suit. Le travail doit se voir d'où qu'on soit. */
  lecture?: CarteVivanteData | null;
}) {
  const questions = suggestions.filter((s) => s.kind === "question");
  // La ligne « je lis encore » du brief vient du cache : la lecture en direct
  // la remplace quand on l'a.
  const others = suggestions.filter(
    (s) => s.kind !== "question" && !(lecture && s.kind === "lecture"),
  );
  const compteurs = lecture ? compteursLecture(lecture) : null;
  return (
    <RelvoBlock label="Dernières nouvelles" className="apparait pb-2">
      {lecture ? (
        <>
          <RelvoSentence>
            {phraseLecture(lecture)}
            <PointsQuiRespirent />
          </RelvoSentence>
          <Link href="/relvo?from=%2F" className={RELVO_LINK}>
            → Suivre la lecture{compteurs ? ` : ${compteurs}` : ""}
          </Link>
        </>
      ) : (
        <RelvoSentence>{newsSentence(news, hasChannels)}</RelvoSentence>
      )}
      {!hasChannels && !lecture ? (
        <Link href="/canaux" className={RELVO_LINK}>
          → Relier ma boîte e-mail
        </Link>
      ) : null}
      {/* Un lien fléché : retrait suspendu (la seconde ligne s'aligne sous le
          texte, pas sous la flèche) et une hauteur de frappe qui tient au pouce. */}
      {others.map((s, i) => (
        <Link
          key={`${s.kind}-${i}`}
          href={suggestionHref(s)}
          className={RELVO_LINK}
        >
          → {s.text}
        </Link>
      ))}
      {/* En dernier des lignes : un réglage de l'appareil, pas une nouvelle. */}
      <LienNotifications clePublique={clePublique} />
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
    </RelvoBlock>
  );
}
