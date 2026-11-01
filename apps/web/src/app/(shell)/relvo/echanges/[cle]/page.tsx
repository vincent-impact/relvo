import { after } from "next/server";
import { ensureOnboardingQuestions, enrichSubjects } from "@relvo/db";
import { EchangeRelvo } from "@/components/relvo-chat/echange-relvo";
import {
  toSubjectRowData,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import {
  CLE_LECTURE_EN_ATTENTE,
  echangesDeRelvo,
} from "@/server/echanges-relvo";
import { relancerLignesEnPanne } from "@/server/ia/pipeline/rattrapage";
import { estEnPanne } from "@/server/ia/pipeline/rattrapage-regles";

// Un ÉCHANGE DE RELVO (05 §11.12) : la page de ce que Relvo a à dire, nommée
// par sa clé — `prise-en-main`, `lecture:<id>`, `sujet:<id>`, `dossiers`,
// `boite:<canal>`, `question:<id>`. La notification, la ligne de l'accueil et
// la tête de l'échange vide mènent ici. `from` garde la page d'origine.

/** Sujets montrés sous la carte d'une lecture ; « Tous les sujets » pour le reste. */
const AFFAIRES_DU_MOMENT = 5;

export default async function EchangeRelvoPage({
  params,
  searchParams,
}: {
  params: Promise<{ cle: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ cle: brute }, { from }] = await Promise.all([params, searchParams]);
  const cle = decodeURIComponent(brute);
  const backHref = from && from !== cle ? from : "/relvo";
  const accountId = await requireAccountId();
  const db = await getTenantDb();

  // Les étapes du script qui restent à poser naissent ici aussi : ouvrir la
  // prise en main depuis une notification ne doit rien rater.
  await ensureOnboardingQuestions(db, accountId);
  const tout = await echangesDeRelvo(db);
  const echange = tout.echanges.find((e) => e.cle === cle) ?? null;

  const ouvertes = (echange?.ouvertes ?? [])
    .map((id) => tout.ouvertes.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null);
  const passees = (echange?.passees ?? [])
    .map((id) => tout.passees.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null);

  const lecture = echange?.lectureId
    ? (tout.cartes.get(echange.lectureId) ?? null)
    : null;
  let sujets: SubjectRowData[] = [];
  if (echange?.lectureId && echange.lectureId !== CLE_LECTURE_EN_ATTENTE) {
    const rattrapage = await db.channelCatchup.findFirst({
      where: { id: echange.lectureId },
    });
    if (rattrapage) {
      // Une ligne dont plus aucune tranche ne s'occupe est RELANCÉE après la
      // réponse — c'est la reprise quand l'application se rouvre (M7.19).
      if (estEnPanne(rattrapage)) after(() => relancerLignesEnPanne(db));
      const nees = await db.subject.findMany({
        where: {
          createdAt: { gte: rattrapage.requestedAt },
          status: { in: ["open", "validated"] },
        },
        orderBy: { createdAt: "desc" },
        take: AFFAIRES_DU_MOMENT,
      });
      sujets = (await enrichSubjects(db, nees)).map(toSubjectRowData);
    }
  }

  const sujet = echange?.subjectId
    ? await db.subject.findFirst({
        where: { id: echange.subjectId },
        select: { id: true, title: true },
      })
    : null;

  return (
    <EchangeRelvo
      echange={echange}
      backHref={backHref}
      ouvertes={ouvertes}
      passees={passees}
      lecture={lecture}
      sujets={sujets}
      sujet={sujet}
    />
  );
}
