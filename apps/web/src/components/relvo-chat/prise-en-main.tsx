"use client";

import Link from "next/link";
import {
  CarteVivante,
  type CarteVivanteData,
} from "@/components/shared/carte-vivante";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";

// La PRISE EN MAIN dans l'échange (05 §11.11, M13.2) : pendant que Relvo lit
// le courrier, le fil montre UNE carte vivante qui se met à jour, une
// explication en deux phrases — texte fixe, dans la voix de Relvo, selon
// l'état de la lecture : jamais un appel au modèle —, et les affaires du
// moment sous la carte, rendues par la ligne ordinaire du produit (01 §11).
// Les questions du script se posent en dessous (`QuestionsRelvo`). Composé
// de primitives existantes : rien ici n'a de matière à lui.

/** Ce que Relvo explique, en deux phrases, selon l'état de la lecture. */
function explication(lecture: CarteVivanteData): string | null {
  switch (lecture.status) {
    case "pending":
    case "running":
      return "Une affaire, c’est un sujet qui demande quelque chose de vous : un devis, une panne, une candidature. J’y range les messages, les tâches et ce que j’en sais.";
    case "done":
    case "capped":
      return lecture.subjectsOpened > 0
        ? "Une tâche, c’est ce qu’il reste à faire sur une affaire. Vous la cochez, je la retire."
        : null;
    default:
      return null;
  }
}

export function PriseEnMain({
  lecture,
  affaires,
}: {
  lecture: CarteVivanteData;
  /** Les affaires nées de cette lecture, les plus récentes d'abord. */
  affaires: SubjectRowData[];
}) {
  const phrase = explication(lecture);
  return (
    <div className="mb-3 space-y-3">
      <CarteVivante data={lecture} />
      {phrase || affaires.length > 0 ? (
        <RelvoBlock className="pb-2.5" label="Les affaires du moment">
          {phrase ? <RelvoSentence>{phrase}</RelvoSentence> : null}
          {affaires.length > 0 ? (
            <div className="mt-2.5 overflow-hidden rounded-(--rayon-sous-carte) border border-(--filet) bg-white [&>*:last-child_[data-list-row]]:border-b-0 [&>[data-list-row]:last-child]:border-b-0">
              {affaires.map((a) => (
                <SubjectRow key={a.id} data={a} />
              ))}
            </div>
          ) : null}
          {affaires.length > 0 ? (
            <Link
              href="/fil"
              className="mt-1.5 block py-1.5 text-[14px] leading-[18px] font-medium text-relvo active:opacity-80"
            >
              → Toutes les affaires
            </Link>
          ) : null}
        </RelvoBlock>
      ) : null}
    </div>
  );
}
