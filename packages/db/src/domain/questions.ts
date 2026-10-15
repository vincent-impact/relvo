import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  KnowledgeKind,
  QuestionScope,
  QuestionStatus,
  type Sector,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { setSectors } from "./accounts";
import { assertFound, DomainError } from "./errors";
import { avecOrigine, EVENT_TYPES, logEvent, type Origine } from "./events";
import { getDefaultFolder } from "./folders";
import { createNote } from "./knowledge";

// Domaine QUESTIONS DE RELVO (M18.9, livré par M10 — 02 RelvoQuestion, 05
// §11.12) : l'objet par lequel Relvo parle en premier. Une question porte une
// portée — un contact, un domaine, une affaire, ou le COMPTE pour une étape de
// script —, un texte, des réponses proposées quand elle se pose en formulaire,
// et sa destination : une réponse structurée modifie un objet du compte par la
// même fonction que l'écran ; une réponse libre devient une INSTRUCTION, en
// couche Compte ou Domaine (05 §11.11) — jamais la couche Produit.
//
// ⚠️ Une question n'est jamais une tâche (02). Tant qu'elle est ouverte, elle
// porte le badge du bouton Relvo et la ligne de l'accueil ; répondue ou
// écartée, elle ne se repose pas.

export const proposedAnswerSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  hint: z.string().trim().max(120).optional(),
});
export type ProposedAnswer = z.infer<typeof proposedAnswerSchema>;

export const askQuestionSchema = z
  .object({
    scope: z.enum(QuestionScope),
    contactId: z.uuid().optional().nullable(),
    folderId: z.uuid().optional().nullable(),
    subjectId: z.uuid().optional().nullable(),
    text: z.string().trim().min(1).max(500),
    proposedAnswers: z.array(proposedAnswerSchema).max(6).optional(),
    /** L'étape de script d'origine — une seule question ouverte par étape. */
    originStep: z.string().trim().max(60).optional().nullable(),
    originSubjectId: z.uuid().optional().nullable(),
  })
  .refine(
    (q) => {
      const cibles = [q.contactId, q.folderId, q.subjectId].filter(Boolean);
      if (q.scope === QuestionScope.account) return cibles.length === 0;
      const attendue =
        q.scope === QuestionScope.contact
          ? q.contactId
          : q.scope === QuestionScope.folder
            ? q.folderId
            : q.subjectId;
      return cibles.length === 1 && Boolean(attendue);
    },
    { message: "Une question a exactement une cible, celle de sa portée." },
  );
export type AskQuestionInput = z.input<typeof askQuestionSchema>;

/** Les réponses proposées d'une question, lues sans faire confiance à la colonne. */
export function readProposedAnswers(raw: unknown): ProposedAnswer[] {
  const parsed = z.array(proposedAnswerSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/**
 * Pose une question. Pour une étape de script, une question ouverte de la
 * même étape n'est pas reposée : la première reste.
 */
export async function askQuestion(db: TenantDb, input: AskQuestionInput) {
  const data = askQuestionSchema.parse(input);
  return db.$transaction(async (tx) => {
    if (data.originStep) {
      const deja = await tx.relvoQuestion.findFirst({
        where: { originStep: data.originStep, status: QuestionStatus.open },
      });
      if (deja) return deja;
    }
    const q = await tx.relvoQuestion.create({
      data: {
        scope: data.scope,
        contactId: data.contactId ?? null,
        folderId: data.folderId ?? null,
        subjectId: data.subjectId ?? null,
        text: data.text,
        proposedAnswers: data.proposedAnswers
          ? (data.proposedAnswers as Prisma.InputJsonValue)
          : Prisma.DbNull,
        originStep: data.originStep ?? null,
        originSubjectId: data.originSubjectId ?? null,
      } as Prisma.RelvoQuestionUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: q.id,
      subjectId: q.subjectId,
      eventType: EVENT_TYPES.questionAsked,
      title: `Question de Relvo : ${q.text}`,
      actor: Actor.ai,
      metadata: { scope: q.scope, originStep: q.originStep },
    });
    return q;
  });
}

export const answerQuestionSchema = z.object({
  /** La clé d'une réponse proposée, ou null pour une réponse libre. */
  key: z.string().trim().max(40).optional().nullable(),
  /** La réponse en clair — le libellé de la clé, ou le texte libre. */
  answer: z.string().trim().min(1).max(2_000),
});
export type AnswerQuestionInput = z.input<typeof answerQuestionSchema>;

/** Ce que la réponse a fait sur le compte, en langage client. */
export type QuestionOutcome =
  | { kind: "sectors"; sectors: Sector[] }
  | { kind: "instruction"; noteId: string; folderName: string }
  | { kind: "noted" };

/**
 * RÉPOND à une question : la ferme, et applique sa destination (05 §11.11,
 * §11.12) — par la fonction du domaine que l'écran appellerait. Les étapes de
 * script connues ont leur destination ; toute autre réponse libre devient une
 * instruction du domaine de la portée, sinon de « Général ».
 */
export async function answerQuestion(
  db: TenantDb,
  id: string,
  input: AnswerQuestionInput,
  origine?: Origine,
): Promise<{ question: { id: string }; outcome: QuestionOutcome }> {
  const data = answerQuestionSchema.parse(input);
  const q = assertFound(
    await db.relvoQuestion.findFirst({ where: { id } }),
    "Question",
  );
  if (q.status !== QuestionStatus.open) {
    throw new DomainError(
      "INVALID_STATE",
      "Cette question n'est plus ouverte.",
    );
  }

  const outcome = await appliquerDestination(db, q, data, origine);

  await db.relvoQuestion.update({
    where: { id },
    data: {
      status: QuestionStatus.answered,
      answer: data.answer,
      answeredAt: new Date(),
    },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: q.id,
    subjectId: q.subjectId,
    eventType: EVENT_TYPES.questionAnswered,
    title: `Réponse à Relvo : ${q.text}`,
    description: data.answer,
    actor: Actor.user,
    metadata: avecOrigine(
      {
        key: data.key ?? null,
        outcome: outcome.kind,
        originStep: q.originStep,
      },
      origine,
    ),
  });
  return { question: { id: q.id }, outcome };
}

async function appliquerDestination(
  db: TenantDb,
  q: {
    id: string;
    accountId: string;
    scope: QuestionScope;
    folderId: string | null;
    subjectId: string | null;
    text: string;
    originStep: string | null;
  },
  data: z.infer<typeof answerQuestionSchema>,
  origine?: Origine,
): Promise<QuestionOutcome> {
  // Les étapes de script qui modifient un objet du compte.
  if (q.originStep === ETAPES.secteurs) {
    const sectors = SECTEURS_PAR_CLE[data.key ?? ""];
    if (sectors) {
      await setSectors(db, q.accountId, sectors, origine);
      return { kind: "sectors", sectors: [...sectors] };
    }
    // Une réponse libre sur les secteurs : on la note, rien de plus.
    return { kind: "noted" };
  }
  if (data.key && data.key !== CLE_AUTRE) {
    // Une réponse fermée hors script : notée, c'est tout — sa destination
    // appartient à celui qui a posé la question (M17).
    return { kind: "noted" };
  }
  // Une réponse libre devient une instruction, en couche Compte ou Domaine.
  const folderId =
    q.folderId ??
    (q.subjectId
      ? ((
          await db.subject.findFirst({
            where: { id: q.subjectId },
            select: { folderId: true },
          })
        )?.folderId ?? null)
      : null) ??
    (await getDefaultFolder(db))?.id ??
    null;
  if (!folderId) return { kind: "noted" };
  const note = await createNote(
    db,
    {
      folderId,
      name: titreInstruction(q.text),
      content: data.answer,
    },
    origine,
  );
  const folder = await db.folder.findFirst({
    where: { id: folderId },
    select: { name: true },
  });
  return {
    kind: "instruction",
    noteId: note.id,
    folderName: folder?.name ?? "Général",
  };
}

/** Le titre d'une instruction née d'une question : la question, sans son point d'interrogation ni son exemple. */
export function titreInstruction(question: string): string {
  const t = question
    .split(/\s+Par exemple/i)[0]!
    .replace(/\s*\?+\s*$/, "")
    .trim();
  return (
    (t.length > 110 ? `${t.slice(0, 110).trimEnd()}…` : t) || "Instruction"
  );
}

/** ÉCARTE une question : jamais reposée. */
export async function dismissQuestion(
  db: TenantDb,
  id: string,
  origine?: Origine,
) {
  const q = assertFound(
    await db.relvoQuestion.findFirst({ where: { id } }),
    "Question",
  );
  if (q.status !== QuestionStatus.open) return q;
  const maj = await db.relvoQuestion.update({
    where: { id },
    data: { status: QuestionStatus.dismissed, answeredAt: new Date() },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: q.id,
    subjectId: q.subjectId,
    eventType: EVENT_TYPES.questionDismissed,
    title: `Question écartée : ${q.text}`,
    actor: Actor.user,
    metadata: avecOrigine({ originStep: q.originStep }, origine),
  });
  return maj;
}

export type OpenQuestion = {
  id: string;
  scope: QuestionScope;
  text: string;
  proposedAnswers: ProposedAnswer[];
  originStep: string | null;
  /** La fiche concernée, pour la nommer dans l'échange. */
  about: { kind: "subject" | "contact" | "folder"; label: string } | null;
  askedAt: string;
};

/** Les questions ouvertes, les plus anciennes d'abord : on répond dans l'ordre. */
export async function listOpenQuestions(
  db: TenantDb,
  opts: { limit?: number } = {},
): Promise<OpenQuestion[]> {
  const rows = await db.relvoQuestion.findMany({
    where: { status: QuestionStatus.open },
    orderBy: { askedAt: "asc" },
    take: opts.limit ?? 5,
    include: {
      subject: { select: { title: true } },
      contact: { select: { firstName: true, lastName: true } },
      folder: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    text: r.text,
    proposedAnswers: readProposedAnswers(r.proposedAnswers),
    originStep: r.originStep,
    about: r.subject
      ? { kind: "subject", label: r.subject.title }
      : r.contact
        ? {
            kind: "contact",
            label: r.contact.firstName
              ? `${r.contact.firstName} ${r.contact.lastName}`
              : r.contact.lastName,
          }
        : r.folder
          ? { kind: "folder", label: r.folder.name }
          : null,
    askedAt: r.askedAt.toISOString(),
  }));
}

export function countOpenQuestions(db: TenantDb): Promise<number> {
  return db.relvoQuestion.count({ where: { status: QuestionStatus.open } });
}

// ─────────────────────────────────────────────────────────────
// Le script de la prise en main (M10.16, 05 §11.11) — ses étapes en texte fixe
// ─────────────────────────────────────────────────────────────

export const CLE_AUTRE = "autre";

export const ETAPES = {
  secteurs: "prise-en-main/secteurs",
  premiereInstruction: "prise-en-main/premiere-instruction",
} as const;

const SECTEURS_PAR_CLE: Record<string, readonly Sector[]> = {
  food: ["food"],
  construction: ["construction"],
  "food+construction": ["food", "construction"],
  other: ["other"],
};

export type EtapeScript = {
  step: (typeof ETAPES)[keyof typeof ETAPES];
  text: string;
  proposedAnswers: ProposedAnswer[];
  /** L'étape ne se pose que si elle a encore quelque chose à apprendre. */
  applicable: (compte: {
    sectors: Sector[];
    instructionsGenerales: number;
  }) => boolean;
};

/**
 * Les étapes du script, dans l'ordre, dans la voix de Relvo — aucun appel au
 * modèle pour les mener (05 §11.11). Chaque réponse a sa destination dans
 * `appliquerDestination`. Peu nombreuses, jamais bloquantes.
 */
export const SCRIPT_PRISE_EN_MAIN: readonly EtapeScript[] = [
  {
    step: ETAPES.secteurs,
    text: "Pour mieux lire votre courrier : dans quel métier êtes-vous ?",
    proposedAnswers: [
      { key: "food", label: "La restauration, l'alimentaire" },
      { key: "construction", label: "Le bâtiment, les travaux" },
      { key: "food+construction", label: "Les deux" },
      { key: "other", label: "Un autre métier" },
    ],
    applicable: (c) => c.sectors.length === 0,
  },
  {
    step: ETAPES.premiereInstruction,
    text: "Y a-t-il une règle que je dois toujours suivre ? Par exemple « les devis au-dessus de 5 000 € passent par moi ».",
    proposedAnswers: [{ key: CLE_AUTRE, label: "Je vous l'écris…" }],
    applicable: (c) => c.instructionsGenerales === 0,
  },
];

/**
 * Pose les étapes du script qui restent à poser — idempotent : une étape déjà
 * posée, répondue ou écartée ne revient pas, une étape sans rien à apprendre
 * ne se pose pas. Appelé à l'ouverture de l'échange ; le même script rejoue,
 * plus court, à chaque connexion d'un canal (05 §11.11).
 */
export async function ensureOnboardingQuestions(
  db: TenantDb,
  accountId: string,
): Promise<number> {
  const [account, general, deja] = await Promise.all([
    db.account.findUnique({
      where: { id: accountId },
      select: { sectors: true },
    }),
    getDefaultFolder(db),
    db.relvoQuestion.findMany({
      where: { originStep: { not: null } },
      select: { originStep: true },
    }),
  ]);
  if (!account) return 0;
  const instructionsGenerales = general
    ? await db.knowledgeDocument.count({
        where: { folderId: general.id, kind: KnowledgeKind.note },
      })
    : 0;
  const posees = new Set(deja.map((d) => d.originStep));
  let n = 0;
  for (const etape of SCRIPT_PRISE_EN_MAIN) {
    if (posees.has(etape.step)) continue;
    if (!etape.applicable({ sectors: account.sectors, instructionsGenerales }))
      continue;
    await askQuestion(db, {
      scope: QuestionScope.account,
      text: etape.text,
      proposedAnswers: etape.proposedAnswers,
      originStep: etape.step,
    });
    n++;
  }
  return n;
}
