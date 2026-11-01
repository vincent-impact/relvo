import {
  canalDeLEtapeDeMigration,
  ETAPES,
  estUneEtapeBoite,
} from "./questions";
import { ETAPE_DOMAINE_PROPOSE } from "./folders";
import { QuestionStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";

// LES ÉCHANGES DE RELVO (05 §11.12, recette de l'alpha) — pur, tenu par
// `test/echanges-relvo.test.ts`. Relvo ne mélange pas ce qu'il a à dire avec
// la discussion du dirigeant : chaque chose est un ÉCHANGE À PART, avec son
// titre, regroupé par son ORIGINE — l'étape du script → « Prise en main », la
// lecture d'une boîte → « Lecture de … », la structuration d'un sujet →
// l'échange de ce sujet, un dossier proposé par le courrier → « Des dossiers
// pour votre courrier », la migration d'une boîte → la boîte. Rien ne change
// au persisté : la `RelvoQuestion` reste l'état, c'est sa VUE qui se regroupe.
// Le disque ouvre toujours un échange vide ; ce que Relvo attend se lit en
// tête, une ligne par échange ; le badge compte les échanges qui attendent
// une réponse ; la notification et l'accueil mènent à l'échange concerné.

export type NatureEchangeRelvo =
  | "migration"
  | "prise-en-main"
  | "lecture"
  | "dossiers"
  | "sujet"
  | "question";

export type QuestionPourEchange = {
  id: string;
  text: string;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  originStep: string | null;
  subjectId: string | null;
  originSubjectId: string | null;
  /** Le titre du sujet concerné, pour nommer l'échange. */
  subjectTitle?: string | null;
  askedAt: Date;
  answeredAt: Date | null;
};

export type LecturePourEchange = {
  id: string;
  channelName: string | null;
  status: string;
  messagesImported: number;
  subjectsOpened: number;
  requestedAt: Date;
};

export type EchangeRelvo = {
  /** La clé, stable, qui nomme l'échange dans l'adresse et la notification. */
  cle: string;
  nature: NatureEchangeRelvo;
  titre: string;
  /** Une ligne grise sous le titre : où on en est. */
  sousTitre: string;
  /** Les questions ouvertes, dans l'ordre où l'on y répond. */
  ouvertes: string[];
  /** Les questions répondues ou écartées de cet échange, les plus anciennes d'abord. */
  passees: string[];
  lectureId: string | null;
  channelId: string | null;
  subjectId: string | null;
  /** Le début de l'échange, ISO 8601. */
  depuis: string;
};

const PREFIXE_SCRIPT = "prise-en-main/";

/**
 * La clé de l'échange qui porte une question — pure, d'après la question
 * seule : la notification qui naît avec elle sait où mener.
 */
export function cleDeLaQuestion(q: {
  id: string;
  originStep: string | null;
  subjectId: string | null;
  originSubjectId: string | null;
}): string {
  const step = q.originStep;
  if (step) {
    const canal = canalDeLEtapeDeMigration(step);
    if (canal) return `boite:${canal}`;
    if (step.startsWith(`${ETAPES.finDeLecture}/`)) {
      return `lecture:${step.slice(ETAPES.finDeLecture.length + 1)}`;
    }
    if (step.startsWith(PREFIXE_SCRIPT)) return "prise-en-main";
    if (step.startsWith(`${ETAPE_DOMAINE_PROPOSE}/`)) return "dossiers";
  }
  const sujet = q.subjectId ?? q.originSubjectId;
  if (sujet) return `sujet:${sujet}`;
  return `question:${q.id}`;
}

/** La nature d'un échange, lue dans sa clé. */
export function natureDeLaCle(cle: string): NatureEchangeRelvo {
  if (cle === "prise-en-main") return "prise-en-main";
  if (cle === "dossiers") return "dossiers";
  if (cle.startsWith("boite:")) return "migration";
  if (cle.startsWith("lecture:")) return "lecture";
  if (cle.startsWith("sujet:")) return "sujet";
  return "question";
}

const RANG: Record<NatureEchangeRelvo, number> = {
  migration: 0,
  "prise-en-main": 1,
  lecture: 2,
  dossiers: 3,
  sujet: 4,
  question: 4,
};

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/** Le titre d'une question quand il nomme l'échange : la question, bornée. */
export function titreDeQuestion(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max / 2 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:.!?]+$/, "")}…`;
}

function sousTitreLecture(l: LecturePourEchange): string {
  const compteurs = [
    pluriel(l.subjectsOpened, "sujet ouvert", "sujets ouverts"),
    pluriel(l.messagesImported, "message lu", "messages lus"),
  ].join(", ");
  switch (l.status) {
    case "pending":
      return "Ça commence";
    case "running":
      return `En cours · ${compteurs}`;
    case "done":
    case "capped":
      return `Terminée · ${compteurs}`;
    default:
      return `Interrompue · ${compteurs}`;
  }
}

/**
 * Regroupe les questions — ouvertes et passées — et les lectures en échanges
 * de Relvo, dans l'ordre où on les ouvre : la migration d'une boîte d'abord
 * (elle a été poussée au dirigeant), la prise en main, les lectures, les
 * dossiers proposés, puis le reste, les plus anciens d'abord. Un échange sans
 * question ouverte ni lecture vivante n'existe pas : ce qui est fini ne se
 * montre plus.
 */
export function regrouperEchangesRelvo(input: {
  questions: QuestionPourEchange[];
  lectures: LecturePourEchange[];
  /** L'adresse des boîtes à migrer, par canal, pour nommer leur échange. */
  boites?: Record<string, string>;
}): EchangeRelvo[] {
  const groupes = new Map<string, EchangeRelvo>();
  const questionsParCle = new Map<string, QuestionPourEchange[]>();

  for (const l of input.lectures) {
    const cle = `lecture:${l.id}`;
    groupes.set(cle, {
      cle,
      nature: "lecture",
      titre: l.channelName
        ? `Lecture de ${l.channelName}`
        : "Lecture de votre boîte",
      sousTitre: sousTitreLecture(l),
      ouvertes: [],
      passees: [],
      lectureId: l.id,
      channelId: null,
      subjectId: null,
      depuis: l.requestedAt.toISOString(),
    });
  }

  const triees = [...input.questions].sort(
    (a, b) => a.askedAt.getTime() - b.askedAt.getTime(),
  );
  for (const q of triees) {
    const cle = cleDeLaQuestion(q);
    const liste = questionsParCle.get(cle) ?? [];
    liste.push(q);
    questionsParCle.set(cle, liste);
  }

  for (const [cle, qs] of questionsParCle) {
    const ouvertes = qs.filter((q) => q.status === "open");
    const passees = qs.filter((q) => q.status !== "open");
    const nature = natureDeLaCle(cle);
    const existant = groupes.get(cle);
    if (existant) {
      // Une lecture vivante porte sa question de fin.
      existant.ouvertes = ouvertes.map((q) => q.id);
      existant.passees = passees.map((q) => q.id);
      continue;
    }
    if (ouvertes.length === 0) continue;
    const premiere = ouvertes[0]!;
    const base = {
      cle,
      nature,
      ouvertes: ouvertes.map((q) => q.id),
      passees: passees.map((q) => q.id),
      lectureId: null,
      channelId: null,
      subjectId: null,
      depuis: qs[0]!.askedAt.toISOString(),
    };
    switch (nature) {
      case "prise-en-main": {
        const boite = ouvertes.some((q) => estUneEtapeBoite(q.originStep));
        groupes.set(cle, {
          ...base,
          titre: "Prise en main",
          sousTitre:
            ouvertes.length === 1
              ? boite
                ? "Il reste la boîte à lire"
                : "Il reste une étape"
              : `Il reste ${ouvertes.length} étapes${boite ? " · la boîte à lire en dernier" : ""}`,
        });
        break;
      }
      case "migration": {
        const canal = cle.slice("boite:".length);
        const adresse = input.boites?.[canal];
        groupes.set(cle, {
          ...base,
          channelId: canal,
          titre: adresse ? `Votre boîte ${adresse}` : "Votre boîte e-mail",
          sousTitre: "À relier à nouveau avec Google",
        });
        break;
      }
      case "lecture": {
        // Une question de fin de lecture dont la lecture n'est plus montrée :
        // l'échange reste, nommé par la question.
        groupes.set(cle, {
          ...base,
          lectureId: cle.slice("lecture:".length),
          titre: "Lecture de votre boîte",
          sousTitre: "Terminée · une question pour vous",
        });
        break;
      }
      case "dossiers":
        groupes.set(cle, {
          ...base,
          titre: "Des dossiers pour votre courrier",
          sousTitre: pluriel(ouvertes.length, "proposition", "propositions"),
        });
        break;
      case "sujet": {
        const subjectId = cle.slice("sujet:".length);
        const sujet = qs.find((q) => q.subjectTitle)?.subjectTitle ?? null;
        groupes.set(cle, {
          ...base,
          subjectId,
          titre: titreDeQuestion(premiere.text),
          sousTitre: sujet
            ? ouvertes.length > 1
              ? `${pluriel(ouvertes.length, "question", "questions")} sur le sujet ${sujet}`
              : `Une question sur le sujet ${sujet}`
            : ouvertes.length > 1
              ? pluriel(ouvertes.length, "question", "questions")
              : "Une question de Relvo",
        });
        break;
      }
      default:
        groupes.set(cle, {
          ...base,
          titre: titreDeQuestion(premiere.text),
          sousTitre: "Une question de Relvo",
        });
    }
  }

  return [...groupes.values()].sort(
    (a, b) =>
      RANG[a.nature] - RANG[b.nature] || a.depuis.localeCompare(b.depuis),
  );
}

/**
 * Le nombre d'échanges qui ATTENDENT une réponse — le badge du disque
 * (invariant 36) : d'après les questions ouvertes seules, sans la base des
 * lectures, parce qu'une lecture qui tourne n'attend rien du dirigeant.
 */
export function compterEchangesEnAttente(
  questions: {
    id: string;
    originStep: string | null;
    subjectId: string | null;
    originSubjectId: string | null;
  }[],
): number {
  return new Set(questions.map(cleDeLaQuestion)).size;
}

/** Le badge du disque, lu en base : les échanges qui attendent une réponse. */
export async function countEchangesEnAttente(db: TenantDb): Promise<number> {
  const rows = await db.relvoQuestion.findMany({
    where: { status: QuestionStatus.open },
    select: {
      id: true,
      originStep: true,
      subjectId: true,
      originSubjectId: true,
    },
  });
  return compterEchangesEnAttente(rows);
}
