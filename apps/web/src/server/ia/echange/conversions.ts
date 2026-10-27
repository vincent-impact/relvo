import type { ModelMessage } from "ai";
import type { CreateTaskInput } from "@relvo/db";
import { dimancheParis, jourDecale, jourParis } from "@relvo/db/temps";

// Les CONVERSIONS de l'échange (M10) — module PUR, sans base ni modèle :
// ce qu'un argument d'outil devient pour le domaine, et comment le bloc
// volatil du contexte rejoint le dernier message du dirigeant. Tenu par
// `test/ia-echange.test.ts`.

export const DATE_NUE = /^\d{4}-\d{2}-\d{2}$/;
export const HEURE_NUE = /^\d{2}:\d{2}$/;

/** Les types de tâche que l'échange sait créer — les valeurs du domaine. */
export const TYPES_TACHE = [
  "call",
  "reply",
  "decision",
  "check",
  "follow_up",
  "inform",
  "other",
] as const;
export type TypeTache = (typeof TYPES_TACHE)[number];

export type ArgsCreateTask = {
  titre: string;
  date: string | null;
  heure: string | null;
  heure_fin: string | null;
  type: TypeTache | null;
  description: string | null;
};

/**
 * Une heure de calendrier reste NUE (PITFALLS.md #55, règle 3) : « 10:00 » le
 * 16 octobre devient la valeur que l'agenda affiche telle quelle — la même
 * conversion que le formulaire de tâche et que le pipeline, jamais un
 * décalage de fuseau.
 */
export function heureNue(
  date: string | null,
  heure: string | null,
): Date | null {
  if (!date || !heure || !DATE_NUE.test(date) || !HEURE_NUE.test(heure)) {
    return null;
  }
  const d = new Date(`${date}T${heure}:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateNueVersDate(date: string | null): Date | null {
  if (!date || !DATE_NUE.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * L'entrée de `createTask` depuis les arguments de l'outil `create_task`. Le
 * dirigeant a dicté la tâche : elle est la sienne (acteur `user`) — Relvo
 * n'est que la main. Une heure sans date est ignorée ; une heure de fin sans
 * heure de début aussi.
 */
export function versCreateTaskInput(
  args: ArgsCreateTask,
  subjectId: string | null,
): CreateTaskInput {
  const date = args.date && DATE_NUE.test(args.date) ? args.date : null;
  const heure = args.heure && HEURE_NUE.test(args.heure) ? args.heure : null;
  const fin =
    heure && args.heure_fin && HEURE_NUE.test(args.heure_fin)
      ? args.heure_fin
      : null;
  return {
    subjectId,
    title: args.titre.trim(),
    description: args.description?.trim() || null,
    sourceActor: "user",
    ...(args.type ? { kind: args.type } : {}),
    startDate: dateNueVersDate(date),
    startTime: heureNue(date, heure),
    endDate: null,
    endTime: heureNue(date, fin),
  };
}

/** Les périodes toutes faites de `list_tasks` — le reste se dit en jours explicites. */
export const PERIODES_TACHES = [
  "aujourd_hui",
  "demain",
  "semaine",
  "en_retard",
  "sans_date",
  "sujet",
] as const;
export type PeriodeTaches = (typeof PERIODES_TACHES)[number];

export type BornesTaches = {
  depuis: string | null;
  jusquAu: string | null;
  sansDate: boolean;
  enRetard: boolean;
};

function jourNu(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ce qu'une période toute faite devient pour la recherche de tâches, en jours
 * civils FRANÇAIS (#55) : « aujourd'hui » et « demain » sont un jour ; « la
 * semaine » va d'aujourd'hui au dimanche inclus — la semaine civile, pas sept
 * jours glissants ; « en retard » et « sans date » sont des filtres ;
 * « sujet » et l'absence de période ne bornent rien. Des jours explicites
 * (`depuis`, `jusquAu`) l'emportent sur la période.
 */
export function bornesPeriode(
  periode: PeriodeTaches | null,
  now: Date,
  explicites: { depuis?: string | null; jusquAu?: string | null } = {},
): BornesTaches {
  const rien: BornesTaches = {
    depuis: null,
    jusquAu: null,
    sansDate: false,
    enRetard: false,
  };
  let bornes = rien;
  switch (periode) {
    case "aujourd_hui": {
      const j = jourParis(now);
      bornes = { ...rien, depuis: j, jusquAu: j };
      break;
    }
    case "demain": {
      const j = jourNu(jourDecale(now, 1));
      bornes = { ...rien, depuis: j, jusquAu: j };
      break;
    }
    case "semaine":
      bornes = {
        ...rien,
        depuis: jourParis(now),
        jusquAu: jourNu(dimancheParis(now)),
      };
      break;
    case "en_retard":
      bornes = { ...rien, enRetard: true };
      break;
    case "sans_date":
      bornes = { ...rien, sansDate: true };
      break;
    default:
      break;
  }
  const depuis =
    explicites.depuis && DATE_NUE.test(explicites.depuis)
      ? explicites.depuis
      : null;
  const jusquAu =
    explicites.jusquAu && DATE_NUE.test(explicites.jusquAu)
      ? explicites.jusquAu
      : null;
  if (depuis || jusquAu) {
    return { ...bornes, depuis, jusquAu, sansDate: false, enRetard: false };
  }
  return bornes;
}

/** Le titre du bloc de tâches rendu dans le fil. */
export function titreTaches(
  periode: PeriodeTaches | null,
  statut: "ouvertes" | "faites" | null,
): string {
  if (statut === "faites") return "Tâches faites";
  switch (periode) {
    case "aujourd_hui":
      return "Tâches d'aujourd'hui";
    case "demain":
      return "Tâches de demain";
    case "semaine":
      return "Tâches de la semaine";
    case "en_retard":
      return "Tâches en retard";
    case "sans_date":
      return "Tâches sans date";
    case "sujet":
      return "Tâches du sujet";
    default:
      return "Tâches";
  }
}

/** Les délimiteurs du bloc volatil, pour que le modèle le lise comme une donnée. */
export const DEBUT_CONTEXTE = "<contexte>";
export const FIN_CONTEXTE = "</contexte>";

/**
 * Pose le bloc VOLATIL du contexte — l'instant, le brief, la fiche de la page —
 * devant le DERNIER message du dirigeant, et seulement là. Les tours
 * précédents restent nus : c'est ce qui laisse l'historique en cache
 * (PITFALLS.md #49). Sans message du dirigeant en queue, rien n'est posé.
 */
export function injecterVolatil(
  messages: ModelMessage[],
  volatil: string,
): ModelMessage[] {
  const i = messages.map((m) => m.role).lastIndexOf("user");
  if (i < 0) return messages;
  const dernier = messages[i]!;
  if (dernier.role !== "user") return messages;
  const bloc = `${DEBUT_CONTEXTE}\n${volatil}\n${FIN_CONTEXTE}\n\n# Le dirigeant dit\n`;
  const content =
    typeof dernier.content === "string"
      ? bloc + dernier.content
      : [{ type: "text" as const, text: bloc }, ...dernier.content];
  return [
    ...messages.slice(0, i),
    { ...dernier, content } as ModelMessage,
    ...messages.slice(i + 1),
  ];
}

/** La page d'origine, lue depuis `?from=` : le sujet ou le contact ouvert. */
export function lirePage(from: string | null | undefined): {
  page: string | null;
  subjectId: string | null;
  contactId: string | null;
} {
  const page = from?.trim() || null;
  const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
  const sujet = page?.match(new RegExp(`^/sujets/${uuid}`, "i"));
  const contact = page?.match(new RegExp(`^/contacts/${uuid}`, "i"));
  return {
    page,
    subjectId: sujet?.[1] ?? null,
    contactId: contact?.[1] ?? null,
  };
}

/**
 * Retire des tours PRÉCÉDENTS les ancres du fournisseur (`itemId` OpenAI) et
 * les parties de raisonnement. Rejouée avec son ancre, une réponse n'est pas
 * renvoyée : elle est RÉFÉRENCÉE côté OpenAI, qui exige alors l'item de
 * raisonnement qui l'a précédée — que le téléphone n'a jamais reçu
 * (PITFALLS.md #63). Sans ancre, le texte et les appels d'outils repartent en
 * clair, comme n'importe quel historique ; le préfixe caché ne change pas.
 */
export function sansAncresFournisseur(
  messages: ModelMessage[],
): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant" || typeof m.content === "string") return m;
    const content = m.content
      .filter((p) => p.type !== "reasoning")
      .map((p) => {
        if (!("providerOptions" in p)) return p;
        const openai = p.providerOptions?.openai;
        if (!openai || !("itemId" in openai)) return p;
        const { itemId: _ancre, ...reste } = openai;
        void _ancre;
        const providerOptions = { ...p.providerOptions, openai: reste };
        return { ...p, providerOptions };
      });
    return { ...m, content } as ModelMessage;
  });
}
