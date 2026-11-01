import {
  listOpenQuestions,
  regrouperEchangesRelvo,
  type EchangeRelvo,
  type OpenQuestion,
  type QuestionPourEchange,
  type TenantDb,
} from "@relvo/db";
import {
  carteDepuisRattrapage,
  type CarteVivanteData,
} from "@/components/shared/carte-vivante";
import { boiteEnMiseEnRoute, carteEnAttente } from "@/server/lecture-en-cours";

// LES ÉCHANGES DE RELVO, assemblés pour l'application (05 §11.12) : la règle
// de regroupement vit dans le domaine (`regrouperEchangesRelvo`), ici on lui
// apporte la matière — les questions ouvertes et celles répondues depuis peu,
// les lectures vivantes avec leur carte, les boîtes en mise en route, les
// adresses des boîtes à migrer — et on rend ce que les écrans montrent : la
// tête de l'échange vide, la page d'un échange, l'historique.

/** Une lecture finie reste un échange pendant ce délai : le temps de sa question. */
export const LECTURE_FINIE_MS = 2 * 60 * 60 * 1000;
/** Les questions passées d'un échange se montrent sur ce délai. */
const PASSEES_MS = 30 * 24 * 60 * 60 * 1000;
/** Une boîte reliée sans lecture encore : l'échange existe déjà, en attente. */
export const CLE_LECTURE_EN_ATTENTE = "lecture:attente";

export type QuestionPassee = {
  id: string;
  text: string;
  answer: string | null;
  /** Écartée d'un geste, sans réponse. */
  ecartee: boolean;
  answeredAt: string | null;
};

export type EchangesDeRelvo = {
  echanges: EchangeRelvo[];
  /** Les questions ouvertes, projetées pour le formulaire, par identifiant. */
  ouvertes: Map<string, OpenQuestion>;
  passees: Map<string, QuestionPassee>;
  /** La carte vivante d'une lecture, par identifiant de lecture. */
  cartes: Map<string, CarteVivanteData>;
};

export async function echangesDeRelvo(
  db: TenantDb,
  opts: { now?: Date; connected?: boolean } = {},
): Promise<EchangesDeRelvo> {
  const now = opts.now ?? new Date();
  const [questions, lectures, ouvertes] = await Promise.all([
    db.relvoQuestion.findMany({
      where: {
        OR: [
          { status: "open" },
          { answeredAt: { gte: new Date(now.getTime() - PASSEES_MS) } },
          {
            status: "dismissed",
            updatedAt: { gte: new Date(now.getTime() - PASSEES_MS) },
          },
        ],
      },
      include: { subject: { select: { title: true } } },
      orderBy: { askedAt: "asc" },
    }),
    db.channelCatchup.findMany({
      where: {
        OR: [
          { status: { in: ["pending", "running"] } },
          { finishedAt: { gte: new Date(now.getTime() - LECTURE_FINIE_MS) } },
        ],
      },
      orderBy: { requestedAt: "desc" },
      include: { channel: { select: { name: true } } },
    }),
    listOpenQuestions(db, { limit: 200 }),
  ]);

  // Les boîtes à migrer : leur adresse nomme l'échange.
  const canauxAMigrer = questions
    .map((q) => q.originStep)
    .filter((s): s is string => Boolean(s?.startsWith("migration-gmail/")))
    .map((s) => s.slice("migration-gmail/".length));
  const boites: Record<string, string> = {};
  if (canauxAMigrer.length > 0) {
    const rows = await db.channel.findMany({
      where: { id: { in: canauxAMigrer } },
      select: { id: true, identifier: true, name: true },
    });
    for (const r of rows) boites[r.id] = r.identifier || r.name;
  }

  const pourEchange: QuestionPourEchange[] = questions.map((q) => ({
    id: q.id,
    text: q.text,
    status: q.status,
    answer: q.answer,
    originStep: q.originStep,
    subjectId: q.subjectId,
    originSubjectId: q.originSubjectId,
    subjectTitle: q.subject?.title ?? null,
    askedAt: q.askedAt,
    answeredAt: q.answeredAt,
  }));

  const echanges = regrouperEchangesRelvo({
    questions: pourEchange,
    lectures: lectures.map((l) => ({
      id: l.id,
      channelName: l.channel.name,
      status: l.status,
      messagesImported: l.messagesImported,
      subjectsOpened: l.subjectsOpened,
      requestedAt: l.requestedAt,
    })),
    boites,
  });

  const cartes = new Map<string, CarteVivanteData>();
  for (const l of lectures) {
    cartes.set(l.id, carteDepuisRattrapage(l, l.channel.name));
  }

  // Une boîte connectée à l'instant, sans encore sa lecture — le webhook de
  // connexion ou la première tranche n'est pas passé — : l'échange de lecture
  // existe déjà, « ça commence », et sa page se rafraîchit jusqu'à la lecture.
  if (!lectures.some((l) => l.status === "pending" || l.status === "running")) {
    const boitesEmail = await db.channel.findMany({
      where: { type: "email", config: { externalAccountId: { not: null } } },
      include: {
        config: {
          select: {
            externalAccountId: true,
            updatedAt: true,
            connectionData: true,
          },
        },
        catchups: { select: { id: true }, take: 1 },
      },
    });
    const enRoute = boitesEmail.find((b) => boiteEnMiseEnRoute(b));
    const carte = enRoute
      ? carteEnAttente(enRoute.name)
      : opts.connected && boitesEmail.length === 0
        ? carteEnAttente(null)
        : null;
    if (carte) {
      cartes.set(CLE_LECTURE_EN_ATTENTE, carte);
      // À sa place dans l'ordre : après la migration et la prise en main.
      const apres = echanges.findIndex(
        (e) => e.nature !== "migration" && e.nature !== "prise-en-main",
      );
      echanges.splice(apres === -1 ? echanges.length : apres, 0, {
        cle: CLE_LECTURE_EN_ATTENTE,
        nature: "lecture",
        titre: enRoute
          ? `Lecture de ${enRoute.name}`
          : "Lecture de votre boîte",
        sousTitre: "Ça commence",
        ouvertes: [],
        passees: [],
        lectureId: CLE_LECTURE_EN_ATTENTE,
        channelId: enRoute?.id ?? null,
        subjectId: null,
        depuis: now.toISOString(),
      });
    }
  }

  const passees = new Map<string, QuestionPassee>();
  for (const q of questions) {
    if (q.status === "open") continue;
    passees.set(q.id, {
      id: q.id,
      text: q.text,
      answer: q.answer,
      ecartee: q.status === "dismissed",
      answeredAt: (q.answeredAt ?? q.updatedAt).toISOString(),
    });
  }

  return {
    echanges,
    ouvertes: new Map(ouvertes.map((q) => [q.id, q])),
    passees,
    cartes,
  };
}
