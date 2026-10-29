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
import {
  createFolder,
  createFolderFromProposal,
  ETAPE_DOMAINE_PROPOSE,
  getDefaultFolder,
  listFolderProposals,
} from "./folders";
import { createNote } from "./knowledge";
import { MAX_EMAIL_CHANNELS } from "./channels";
import { domainesTypiquesDe } from "./prise-en-main";

// Domaine QUESTIONS DE RELVO (M18.9, livré par M10 — 02 RelvoQuestion, 05
// §11.12) : l'objet par lequel Relvo parle en premier. Une question porte une
// portée — un contact, un domaine, un sujet, ou le COMPTE pour une étape de
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
  /** La réponse s'écrit : le formulaire ouvre un champ libre sous cette clé. */
  libre: z.boolean().optional(),
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
    originStep: z.string().trim().max(80).optional().nullable(),
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
  /** Les clés cochées d'une réponse à choix multiples (les domaines typiques). */
  keys: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  /** La réponse en clair — le libellé de la clé, ou le texte libre. */
  answer: z.string().trim().min(1).max(2_000),
});
export type AnswerQuestionInput = z.input<typeof answerQuestionSchema>;

/** Ce que la réponse a fait sur le compte, en langage client. */
export type QuestionOutcome =
  /** `metier` : « un autre métier », dit en clair, retenu en instruction du compte. */
  | { kind: "sectors"; sectors: Sector[]; metier?: string }
  | { kind: "instruction"; noteId: string; folderName: string }
  /** « Lisez deux semaines de plus » : l'application ouvre la lecture suivante sur ce canal. */
  | { kind: "lecture-etendue"; channelId: string; since: Date }
  /** Des domaines typiques cochés et créés. */
  | { kind: "folders"; names: string[] }
  /** Un domaine proposé par le courrier, créé, et ses sujets rangés. */
  | { kind: "folder-created"; name: string; reclassees: number }
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
      // « Un autre métier » s'écrit : le métier dit devient une instruction
      // du compte — c'est ainsi que Relvo lit le courrier avec ses mots —,
      // et les domaines proposés ensuite sont ceux de tout métier.
      if (data.key === CLE_AUTRE_METIER && estUnMetierDit(data.answer)) {
        await instruireDepuisReponse(
          db,
          { folderId: null, subjectId: null },
          "Mon métier",
          `Mon métier : ${data.answer}`,
          origine,
        );
        return { kind: "sectors", sectors: [...sectors], metier: data.answer };
      }
      return { kind: "sectors", sectors: [...sectors] };
    }
    // Une réponse libre sur les secteurs : on la note, rien de plus.
    return { kind: "noted" };
  }
  if (estUneEtapeBoite(q.originStep)) {
    // La boîte se connecte par la page du fournisseur, et c'est la connexion
    // qui ferme l'étape (`resolveMailboxStep`) ; une réponse directe — « non,
    // c'est tout » — est notée.
    return { kind: "noted" };
  }
  if (canalDeLEtapeDeMigration(q.originStep)) {
    // La migration d'une boîte (M24.9) se fait par le consentement Google, et
    // c'est la bascule qui ferme la question (`migrateChannelToGmail`).
    return { kind: "noted" };
  }
  if (q.originStep?.startsWith(`${ETAPES.finDeLecture}/`)) {
    return appliquerFinDeLecture(db, q, data, origine);
  }
  if (q.originStep === ETAPES.domainesTypiques) {
    return appliquerDomainesTypiques(db, q.accountId, data);
  }
  if (q.originStep?.startsWith(`${ETAPE_DOMAINE_PROPOSE}/`)) {
    if (data.key !== "oui") return { kind: "noted" };
    const r = await createFolderFromProposal(
      db,
      { name: nomProposeDe(q.text) },
      origine,
    );
    return { kind: "folder-created", name: r.name, reclassees: r.reclassees };
  }
  if (data.key && data.key !== CLE_AUTRE) {
    // Une réponse fermée hors script : notée, c'est tout — sa destination
    // appartient à celui qui a posé la question (M17).
    return { kind: "noted" };
  }
  return instruireDepuisReponse(
    db,
    q,
    titreInstruction(q.text),
    data.answer,
    origine,
  );
}

/**
 * Une réponse libre devient une INSTRUCTION, en couche Compte ou Domaine
 * (05 §11.11) : le domaine de la portée, celui du sujet, sinon Général.
 */
async function instruireDepuisReponse(
  db: TenantDb,
  q: { folderId: string | null; subjectId: string | null },
  name: string,
  content: string,
  origine?: Origine,
): Promise<QuestionOutcome> {
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
  const note = await createNote(db, { folderId, name, content }, origine);
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

/**
 * La FIN DE LECTURE (05 §11.11) : « Oui, c'est ça » est noté ; « Il en
 * manque » et « Il y en a trop » s'écrivent et deviennent une instruction de
 * Général — ce que Relvo doit ouvrir, ou laisser ; « Lisez deux semaines de
 * plus » demande la lecture suivante sur le même canal, que l'application lance.
 */
async function appliquerFinDeLecture(
  db: TenantDb,
  q: {
    originStep: string | null;
    folderId: string | null;
    subjectId: string | null;
  },
  data: z.infer<typeof answerQuestionSchema>,
  origine?: Origine,
): Promise<QuestionOutcome> {
  if (data.key === "manque") {
    return instruireDepuisReponse(
      db,
      q,
      "Ce qui manquait à la première lecture",
      data.answer,
      origine,
    );
  }
  if (data.key === "trop") {
    return instruireDepuisReponse(
      db,
      q,
      "Ce qui était en trop à la première lecture",
      data.answer,
      origine,
    );
  }
  if (data.key === "deux-semaines") {
    const catchupId = q.originStep!.slice(`${ETAPES.finDeLecture}/`.length);
    const lecture = assertFound(
      await db.channelCatchup.findFirst({
        where: { id: catchupId },
        select: { channelId: true, since: true },
      }),
      "Rattrapage",
    );
    return {
      kind: "lecture-etendue",
      channelId: lecture.channelId,
      since: new Date(lecture.since.getTime() - FENETRE_SUIVANTE_MS),
    };
  }
  return { kind: "noted" };
}

/** La lecture suivante remonte d'autant que la première : deux semaines de plus. */
const FENETRE_SUIVANTE_MS = 14 * 86_400_000;

/**
 * Les DOMAINES TYPIQUES cochés (05 §9.6) : chaque clé crée son domaine par la
 * fonction de la Mémoire, avec son logo curé ; un domaine qui existe déjà est
 * laissé tel quel. « Aucun pour l'instant » ne crée rien.
 */
async function appliquerDomainesTypiques(
  db: TenantDb,
  accountId: string,
  data: z.infer<typeof answerQuestionSchema>,
): Promise<QuestionOutcome> {
  const cles = new Set(data.keys ?? (data.key ? [data.key] : []));
  if (cles.size === 0 || cles.has("aucun")) return { kind: "noted" };
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { sectors: true },
  });
  const typiques = domainesTypiquesDe(account?.sectors ?? []);
  const names: string[] = [];
  for (const d of typiques) {
    if (!cles.has(d.key)) continue;
    const existe = await db.folder.findFirst({ where: { slug: d.key } });
    if (existe) {
      names.push(existe.name);
      continue;
    }
    const f = await createFolder(db, {
      name: d.name,
      slug: d.key,
      description: d.description,
      color: d.color,
      icon: d.icon,
    });
    names.push(f.name);
  }
  return names.length ? { kind: "folders", names } : { kind: "noted" };
}

/** Le nom proposé, tel que la question le cite entre guillemets. */
export function nomProposeDe(question: string): string {
  const m = question.match(/«\s*([^»]+?)\s*»/);
  return (m?.[1] ?? question).trim();
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
  /** Plusieurs réponses se gardent (les domaines typiques) : le formulaire se coche. */
  multiple: boolean;
  /** La boîte à lire : chaque réponse ouvre la page de connexion du fournisseur. */
  connecteBoite: boolean;
  /** La boîte à passer au relais Gmail (M24.9) : la réponse rouvre le consentement sur ce canal. */
  migreBoite: string | null;
  /** La fiche concernée, pour la nommer dans l'échange. */
  about: { kind: "subject" | "contact" | "folder"; label: string } | null;
  askedAt: string;
};

/**
 * Les questions ouvertes, dans l'ordre où l'on y répond : la migration d'une boîte
 * d'abord (M24.9), puis les étapes du
 * script dans l'ordre du script — les domaines typiques naissent après le
 * métier mais se posent avant la règle et la boîte —, puis les autres, les
 * plus anciennes d'abord.
 */
export async function listOpenQuestions(
  db: TenantDb,
  opts: { limit?: number } = {},
): Promise<OpenQuestion[]> {
  const rows = await db.relvoQuestion.findMany({
    where: { status: QuestionStatus.open },
    orderBy: { askedAt: "asc" },
    include: {
      subject: { select: { title: true } },
      contact: { select: { firstName: true, lastName: true } },
      folder: { select: { name: true } },
    },
  });
  const rang = (step: string | null) => {
    // La migration d'une boîte (M24.9) passe devant tout : elle a été poussée
    // au dirigeant, c'est pour elle qu'il ouvre l'échange.
    if (canalDeLEtapeDeMigration(step)) return -1;
    const i = SCRIPT_PRISE_EN_MAIN.findIndex((e) => e.step === step);
    return i === -1 ? SCRIPT_PRISE_EN_MAIN.length : i;
  };
  rows.sort(
    (a, b) =>
      rang(a.originStep) - rang(b.originStep) ||
      a.askedAt.getTime() - b.askedAt.getTime(),
  );
  return rows.slice(0, opts.limit ?? 5).map((r) => ({
    id: r.id,
    scope: r.scope,
    // Les étapes de la boîte se lisent VIVANTES — leur texte et leurs
    // propositions sont ceux du script d'aujourd'hui, jamais ceux enregistrés
    // quand l'étape a été posée : une boîte proposée avant la décision
    // « l'e-mail, c'est Gmail » (M24) ne se propose plus.
    text:
      r.originStep && estUneEtapeBoite(r.originStep)
        ? texteDeLEtape(r.originStep, r.text)
        : r.text,
    proposedAnswers:
      r.originStep && estUneEtapeBoite(r.originStep)
        ? propositionsDeLEtape(r.originStep, r.proposedAnswers)
        : readProposedAnswers(r.proposedAnswers),
    originStep: r.originStep,
    multiple: r.originStep === ETAPES.domainesTypiques,
    connecteBoite: estUneEtapeBoite(r.originStep),
    migreBoite: canalDeLEtapeDeMigration(r.originStep),
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

/** Le texte fixe d'une étape du script ; le texte enregistré quand l'étape se calcule depuis le compte. */
function texteDeLEtape(step: string, enregistre: string): string {
  const etape = SCRIPT_PRISE_EN_MAIN.find((e) => e.step === step);
  return typeof etape?.text === "string" ? etape.text : enregistre;
}

/** Les propositions fixes d'une étape ; celles enregistrées quand elles se calculent. */
function propositionsDeLEtape(
  step: string,
  enregistrees: unknown,
): ProposedAnswer[] {
  const etape = SCRIPT_PRISE_EN_MAIN.find((e) => e.step === step);
  return Array.isArray(etape?.proposedAnswers)
    ? [...etape.proposedAnswers]
    : readProposedAnswers(enregistrees);
}

export function estUneEtapeBoite(step: string | null): boolean {
  return step != null && (ETAPES_BOITE as readonly string[]).includes(step);
}

export function countOpenQuestions(db: TenantDb): Promise<number> {
  return db.relvoQuestion.count({ where: { status: QuestionStatus.open } });
}

// ─────────────────────────────────────────────────────────────
// Le script de la prise en main (M10.16, 05 §11.11) — ses étapes en texte fixe
// ─────────────────────────────────────────────────────────────

export const CLE_AUTRE = "autre";
/** « Un autre métier » : la réponse s'écrit, et le métier dit se retient. */
export const CLE_AUTRE_METIER = "other";
/**
 * La boîte que la dernière étape propose : UNE, Gmail — l'e-mail entre dans
 * Relvo par le relais Gmail, et par lui seul (M24, `ecarts`, « L'e-mail, c'est
 * Gmail »). L'indication lève le doute d'une adresse pro, qui n'a rien de
 * google dans son nom et se lit pourtant dans Gmail. Proposée VIVANTE par
 * `listOpenQuestions`, jamais relue de la question enregistrée : une étape
 * posée avant la décision ne propose plus ce qui n'existe plus.
 */
export const BOITES_PROPOSEES = [
  {
    key: "gmail",
    label: "Relier ma boîte Gmail",
    hint: "Une adresse pro lue dans Gmail aussi",
  },
] as const satisfies readonly ProposedAnswer[];

/**
 * « Une autre boîte ? » (M24.8) : posée après la première, une fois. Les
 * dirigeants ont souvent une boîte par activité — un magasin, un chantier.
 */
export const AUTRE_BOITE_PROPOSEE = [
  {
    key: "gmail",
    label: "Relier une autre boîte Gmail",
    hint: "Une adresse pro lue dans Gmail aussi",
  },
  { key: "non", label: "Non, c'est tout pour l'instant" },
] as const satisfies readonly ProposedAnswer[];

/** Les étapes dont une réponse ouvre le consentement de la boîte, et que la connexion ferme. */
export const ETAPES_BOITE = [
  "prise-en-main/premiere-boite",
  "prise-en-main/autre-boite",
] as const;
/** La clé qui, dans ces étapes, ouvre la page du fournisseur. */
export const CLE_RELIER_BOITE = "gmail";

/**
 * La MIGRATION d'une boîte de l'agrégateur vers le relais Gmail (M24.9,
 * `migration-gmail.ts`) : une question par canal, hors script, dont l'étape
 * porte l'identifiant du canal ; la même clé que les étapes de boîte ouvre le
 * consentement Google — sur ce canal, pas sur un nouveau.
 */
export const ETAPE_MIGRATION_GMAIL = "migration-gmail";
export const CLE_MIGRER_BOITE = CLE_RELIER_BOITE;

export function etapeDeMigration(channelId: string): string {
  return `${ETAPE_MIGRATION_GMAIL}/${channelId}`;
}

/** Le canal que vise une étape de migration ; null pour toute autre étape. */
export function canalDeLEtapeDeMigration(step: string | null): string | null {
  const prefixe = `${ETAPE_MIGRATION_GMAIL}/`;
  return step?.startsWith(prefixe) ? step.slice(prefixe.length) : null;
}

export const ETAPES = {
  secteurs: "prise-en-main/secteurs",
  /** À choix multiples (`keys`) : l'échange le sait par l'étape. */
  domainesTypiques: "prise-en-main/domaines-typiques",
  premiereInstruction: "prise-en-main/premiere-instruction",
  /** La boîte à lire, en dernier : se ferme à la connexion, pas par une réponse. */
  premiereBoite: "prise-en-main/premiere-boite",
  /** « Une autre boîte ? », après la première (M24.8) ; « non » répond, la connexion ferme. */
  autreBoite: "prise-en-main/autre-boite",
  /** Préfixe : l'étape porte l'identifiant du rattrapage — une par lecture. */
  finDeLecture: "prise-en-main/fin-de-lecture",
} as const;

const SECTEURS_PAR_CLE: Record<string, readonly Sector[]> = {
  food: ["food"],
  construction: ["construction"],
  "food+construction": ["food", "construction"],
  [CLE_AUTRE_METIER]: ["other"],
};

/** Une réponse libre qui dit un métier — pas le libellé de l'option recliqué. */
function estUnMetierDit(answer: string): boolean {
  const a = answer.trim();
  return a.length > 0 && a.toLowerCase() !== "un autre métier";
}

export type CompteScript = {
  sectors: Sector[];
  instructionsGenerales: number;
  /** Les domaines du compte hors Général. */
  domaines: number;
  /** Les boîtes e-mail connectées au moins une fois chez le fournisseur. */
  boitesEmail: number;
};

export type EtapeScript = {
  step: (typeof ETAPES)[keyof typeof ETAPES];
  /** Le texte, fixe ou calculé depuis le compte (« un autre métier » n'a pas « votre métier »). */
  text: string | ((compte: CompteScript) => string);
  /** Les réponses, fixes ou calculées depuis le compte (les domaines typiques des secteurs). */
  proposedAnswers:
    | ProposedAnswer[]
    | ((compte: CompteScript) => ProposedAnswer[]);
  /** L'étape ne se pose que si elle a encore quelque chose à apprendre. */
  applicable: (compte: CompteScript) => boolean;
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
      {
        key: CLE_AUTRE_METIER,
        label: "Un autre métier",
        hint: "Dites-le-moi en quelques mots",
        libre: true,
      },
    ],
    applicable: (c) => c.sectors.length === 0,
  },
  {
    step: ETAPES.domainesTypiques,
    text: (c) =>
      c.sectors.some((s) => s !== "other")
        ? "Je range vos sujets dans des dossiers, et vous pourrez y faire des dossiers. Dans votre métier, on trouve souvent ceux-ci. Lesquels gardez-vous ?"
        : "Je range vos sujets dans des dossiers, et vous pourrez y faire des dossiers. Voici ceux qu'on retrouve dans la plupart des entreprises. Lesquels gardez-vous ?",
    proposedAnswers: (c) => [
      ...domainesTypiquesDe(c.sectors).map((d) => ({
        key: d.key,
        label: d.name,
        hint: d.description,
      })),
      {
        key: "aucun",
        label: "Aucun pour l'instant, on verra avec le courrier",
      },
    ],
    // Après le métier (il faut connaître les secteurs), et seulement tant que
    // le compte n'a que Général : les domaines émergent du courrier ensuite.
    applicable: (c) =>
      c.domaines === 0 && domainesTypiquesDe(c.sectors).length > 0,
  },
  {
    step: ETAPES.premiereInstruction,
    text: "Y a-t-il une règle que je dois toujours suivre ? Par exemple « Crée automatiquement un sujet urgent quand un client demande la réalisation d'un devis ».",
    proposedAnswers: [{ key: CLE_AUTRE, label: "Je vous l'écris…" }],
    applicable: (c) => c.instructionsGenerales === 0,
  },
  {
    // En dernier : Relvo se configure d'abord, la boîte se confie ensuite. La
    // réponse ouvre la page de connexion du fournisseur ; l'étape se ferme à
    // la connexion (`resolveMailboxStep`), pas au clic — revenir en arrière la
    // laisse ouverte, et elle se repose.
    step: ETAPES.premiereBoite,
    text: "Maintenant, confiez-moi la boîte où arrivent vos fournisseurs et vos clients — une boîte lue dans Gmail, même avec votre adresse pro : je lis le courrier des deux dernières semaines et j'ouvre vos premiers sujets.",
    proposedAnswers: [...BOITES_PROPOSEES],
    applicable: (c) => c.boitesEmail === 0,
  },
  {
    // Après la première boîte, une fois : le même geste, et « non » répond.
    step: ETAPES.autreBoite,
    text: "Une autre boîte à me confier ? Beaucoup de dirigeants en ont une par activité — un magasin, un chantier, une marque. Je la lirai de la même façon.",
    proposedAnswers: [...AUTRE_BOITE_PROPOSEE],
    applicable: (c) => c.boitesEmail >= 1 && c.boitesEmail < MAX_EMAIL_CHANNELS,
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
  const [account, general, deja, domaines, boitesEmail] = await Promise.all([
    db.account.findUnique({
      where: { id: accountId },
      select: { sectors: true },
    }),
    getDefaultFolder(db),
    db.relvoQuestion.findMany({
      where: { originStep: { not: null } },
      select: { originStep: true },
    }),
    db.folder.count({ where: { isDefault: false } }),
    // Les boîtes e-mail qui comptent : connectées chez le fournisseur, ou sans
    // configuration (le jeu de démonstration) — jamais un orphelin de la page
    // de connexion (`isNeverConnected`).
    db.channel.count({
      where: {
        type: "email",
        OR: [
          { config: { is: null } },
          { config: { externalAccountId: { not: null } } },
        ],
      },
    }),
  ]);
  if (!account) return 0;
  const instructionsGenerales = general
    ? await db.knowledgeDocument.count({
        where: { folderId: general.id, kind: KnowledgeKind.note },
      })
    : 0;
  const compte: CompteScript = {
    sectors: account.sectors,
    instructionsGenerales,
    domaines,
    boitesEmail,
  };
  const posees = new Set(deja.map((d) => d.originStep));
  let n = 0;
  for (const etape of SCRIPT_PRISE_EN_MAIN) {
    if (posees.has(etape.step)) continue;
    if (!etape.applicable(compte)) continue;
    await askQuestion(db, {
      scope: QuestionScope.account,
      text: typeof etape.text === "function" ? etape.text(compte) : etape.text,
      proposedAnswers:
        typeof etape.proposedAnswers === "function"
          ? etape.proposedAnswers(compte)
          : etape.proposedAnswers,
      originStep: etape.step,
    });
    n++;
  }
  n += await ensureFolderProposalQuestions(db);
  return n;
}

/**
 * La BOÎTE EST CONNECTÉE : l'étape de boîte encore ouverte — « première
 * boîte » ou « une autre boîte ? » — se ferme, répondue par la connexion
 * elle-même — c'est le geste qui vaut réponse, pas le clic sur l'option
 * (revenir en arrière de la page du fournisseur ne ferme rien). Appelé par le
 * retour de connexion ; sans étape ouverte, ne fait rien.
 */
export async function resolveMailboxStep(
  db: TenantDb,
  identifier: string | null,
): Promise<{ resolved: boolean }> {
  const q = await db.relvoQuestion.findFirst({
    where: {
      originStep: { in: [...ETAPES_BOITE] },
      status: QuestionStatus.open,
    },
    select: { id: true, text: true, originStep: true },
  });
  if (!q) return { resolved: false };
  const answer = identifier
    ? `Boîte connectée : ${identifier}`
    : "Boîte connectée";
  await db.relvoQuestion.update({
    where: { id: q.id },
    data: { status: QuestionStatus.answered, answer, answeredAt: new Date() },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: q.id,
    eventType: EVENT_TYPES.questionAnswered,
    title: `Réponse à Relvo : ${q.text}`,
    description: answer,
    actor: Actor.system,
    metadata: {
      outcome: "mailbox-connected",
      originStep: q.originStep,
    },
  });
  return { resolved: true };
}

/**
 * Les DOMAINES PROPOSÉS PAR LE COURRIER (M17.10) : une question par
 * proposition que plusieurs sujets partagent — posée par la lecture après
 * chaque salve, et à l'ouverture de l'échange pour celles du fil de l'eau.
 * Idempotente : une proposition ouverte, répondue ou écartée ne revient pas.
 * Rend le nombre de questions posées.
 */
export async function ensureFolderProposalQuestions(
  db: TenantDb,
): Promise<number> {
  const propositions = await listFolderProposals(db);
  let n = 0;
  for (const p of propositions) {
    const step = `${ETAPE_DOMAINE_PROPOSE}/${p.slug}`;
    const deja = await db.relvoQuestion.findFirst({
      where: { originStep: step },
      select: { id: true },
    });
    if (deja) continue;
    await askQuestion(db, {
      scope: QuestionScope.account,
      text: `Plusieurs sujets parlent de « ${p.name} » (${p.count}). J'en fais un dossier et je les y range ?`,
      proposedAnswers: [
        { key: "oui", label: "Oui, créez-le" },
        {
          key: "non",
          label: "Non, pas celui-là",
          hint: "Je ne le proposerai plus",
        },
      ],
      originStep: step,
    });
    n++;
  }
  return n;
}

/** Le pluriel d'un compteur de la fin de lecture, en langage client. */
function compte(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/**
 * La FIN DE LECTURE du courrier (05 §11.11) : quand une ligne de rattrapage se
 * clôt avec au moins un sujet ouvert, Relvo le dit et demande si ça
 * ressemble à l'activité du dirigeant — c'est cette question qui porte le
 * badge et la notification (invariant 36). Une par lecture ; rien pour une
 * lecture vide. Rend la question, ou null.
 */
export async function poserFinDeLecture(
  db: TenantDb,
  lecture: {
    id: string;
    subjectsOpened: number;
    conversationsIgnored: number;
  },
) {
  if (lecture.subjectsOpened < 1) return null;
  const compteurs = [
    compte(lecture.subjectsOpened, "sujet ouvert", "sujets ouverts"),
    ...(lecture.conversationsIgnored > 0
      ? [
          compte(
            lecture.conversationsIgnored,
            "message mis de côté",
            "messages mis de côté",
          ),
        ]
      : []),
  ].join(", ");
  return askQuestion(db, {
    scope: QuestionScope.account,
    text: `J'ai fini de lire votre courrier : ${compteurs}. Est-ce que ça ressemble à votre activité ?`,
    proposedAnswers: [
      { key: "oui", label: "Oui, c'est ça" },
      {
        key: "manque",
        label: "Il en manque",
        hint: "Dites-moi ce que j'aurais dû ouvrir",
        libre: true,
      },
      {
        key: "trop",
        label: "Il y en a trop",
        hint: "Dites-moi ce que je dois laisser",
        libre: true,
      },
      {
        key: "deux-semaines",
        label: "Lisez deux semaines de plus",
        hint: "Le courrier des jours quatorze à vingt-huit",
      },
    ],
    originStep: `${ETAPES.finDeLecture}/${lecture.id}`,
  });
}
