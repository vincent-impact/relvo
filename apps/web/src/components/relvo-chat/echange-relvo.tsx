"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EchangeRelvo as EchangeRelvoData, OpenQuestion } from "@relvo/db";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader, SkyTail } from "@/components/layout/relvo-header";
import { PriseEnMain } from "@/components/relvo-chat/prise-en-main";
import {
  QuestionsRelvoVue,
  useQuestionsRelvo,
} from "@/components/relvo-chat/questions-relvo";
import type { CarteVivanteData } from "@/components/shared/carte-vivante";
import { PollRefresh } from "@/components/shared/poll-refresh";
import { RecipientComposer } from "@/components/shared/recipient-composer";
import {
  RELVO_LINK,
  RelvoBlock,
  RelvoSentence,
} from "@/components/shared/relvo-block";
import type { SubjectRowData } from "@/components/shared/subject-row";
import type { QuestionPassee } from "@/server/echanges-relvo";

// UN ÉCHANGE DE RELVO (05 §11.12, recette de l'alpha) : une chose que Relvo a
// à dire, à part de la discussion du dirigeant — la prise en main, la lecture
// d'une boîte, une question née d'un sujet, les dossiers que propose le
// courrier, une boîte à relier. Nommé dans le ciel, avec où on en est. Le fil
// montre ce qui a déjà été répondu dans cet échange — la question de Relvo,
// la réponse en bulle —, puis la question en cours en formulaire. Le composer
// reste là : une réponse tapée est une réponse libre, comme « Je vous
// l'écris… ». Quand la dernière question est répondue, l'échange dit ce qu'il
// a noté, et la page d'origine est à une flèche.

export function EchangeRelvo({
  echange,
  backHref,
  ouvertes,
  passees,
  lecture,
  sujets,
  sujet,
}: {
  /** L'échange, ou null quand plus rien ne l'attend ici. */
  echange: EchangeRelvoData | null;
  backHref: string;
  /** Les questions ouvertes de cet échange, dans l'ordre où l'on y répond. */
  ouvertes: OpenQuestion[];
  /** Les questions déjà répondues ou écartées, les plus anciennes d'abord. */
  passees: QuestionPassee[];
  /** La lecture du courrier que cet échange suit, ou null. */
  lecture: CarteVivanteData | null;
  /** Les sujets nés de cette lecture. */
  sujets: SubjectRowData[];
  /** Le sujet dont l'échange parle, pour la puce. */
  sujet: { id: string; title: string } | null;
}) {
  const q = useQuestionsRelvo(ouvertes);
  const lectureEnCours =
    lecture?.status === "pending" || lecture?.status === "running";
  const rien = !echange && !q.reponduEn;

  return (
    <MobileFrame>
      <RelvoHeader
        back={backHref}
        title={echange?.titre ?? "Relvo"}
        eyebrow="Échange de Relvo"
        subtitle={echange?.sousTitre}
        wrapTitle
        tail={false}
      />
      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4 pb-6">
        <SkyTail className="-mx-4 -mt-4" />
        <div className="flex flex-col gap-3">
          {sujet ? (
            <Link
              href={`/sujets/${sujet.id}`}
              className="inline-flex h-9 max-w-full items-center gap-1.5 self-start rounded-(--rayon-pilule) border border-(--filet) bg-white pr-2 pl-3 text-[13px] font-normal text-noir shadow-carte active:bg-(--fond-enfonce)"
            >
              <span className="truncate">{sujet.title}</span>
              <ChevronRight className="size-3.5 flex-none text-(--gris-clair)" />
            </Link>
          ) : null}

          {lecture ? (
            <>
              <PriseEnMain lecture={lecture} sujets={sujets} />
              {lectureEnCours ? <PollRefresh intervalMs={20_000} /> : null}
            </>
          ) : null}

          {passees.map((p) => (
            <div key={p.id} className="flex flex-col gap-3">
              <RelvoBlock className="pb-2.5">
                <RelvoSentence>{p.text}</RelvoSentence>
              </RelvoBlock>
              {p.ecartee ? (
                <p className="self-end text-[12px] font-normal text-gris">
                  Vous n’avez plus voulu de cette question.
                </p>
              ) : p.answer ? (
                <p className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-(--actor-me) px-3.5 py-2.5 text-[14.5px] leading-5 text-white">
                  {p.answer}
                </p>
              ) : null}
            </div>
          ))}

          <QuestionsRelvoVue q={q} />

          {rien ? (
            <RelvoBlock className="pb-2">
              <RelvoSentence>
                Rien ne vous attend ici : c’est réglé, ou ce n’était pas pour
                vous.
              </RelvoSentence>
              <Link href={backHref} className={RELVO_LINK}>
                → Revenir
              </Link>
            </RelvoBlock>
          ) : null}
          {!echange && q.reponduEn ? (
            <Link href={backHref} className={`${RELVO_LINK} px-1`}>
              → Revenir
            </Link>
          ) : null}
        </div>
      </main>

      {q.question && q.accepteTexteLibre ? (
        <RecipientComposer
          placeholder="Répondre à Relvo…"
          dictee
          onSend={(text) => q.repondreLibre(text)}
        />
      ) : null}
    </MobileFrame>
  );
}
