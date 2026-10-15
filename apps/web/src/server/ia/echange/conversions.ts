import type { ModelMessage } from "ai";
import type { CreateTaskInput } from "@relvo/db";

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

/** La page d'origine, lue depuis `?from=` : l'affaire ou le contact ouvert. */
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
