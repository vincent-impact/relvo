import {
  tool,
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createTask,
  debutDuJourParis,
  enrichSubjects,
  enrichTasks,
  getBriefProjection,
  getOverdueTasks,
  isDomainError,
  jourDecale,
  listTasks,
  loadSubjectSheet,
  resolveSubject,
  type TenantDb,
} from "@relvo/db";
import {
  type SubjectRowData,
  toSubjectRowData,
} from "@/components/shared/subject-row";
import { type TaskItemData, toTaskItemData } from "@/lib/task-item-data";
import { ficheSujet } from "../contexte";
import { TYPES_TACHE, versCreateTaskInput } from "./conversions";

// Les OUTILS de Relvo dans l'échange (M10.8, `05 §11.6`) — la palette de la
// tranche 1 : la lecture, et les trois gestes du prérequis (créer une tâche,
// poser un rendez-vous, résumer une affaire). Chaque outil enveloppe UNE
// fonction du domaine — jamais une server action, jamais une règle réécrite —
// et rend une PROJECTION PRÊTE POUR L'ÉCRAN : le fil affiche une affaire avec
// la ligne d'affaire, une tâche avec la ligne de tâche (01 §11, invariant 31),
// jamais une liste à puces.
//
// Les noms sont ceux de la conception, les descriptions parlent au modèle. Les
// arguments optionnels sont `nullable`, pas `optional` : c'est ce que le mode
// strict du fournisseur accepte.

export type ContactLigne = {
  id: string;
  nom: string;
  entreprise: string | null;
  role: string | null;
  email: string | null;
  telephone: string | null;
};

/** Ce qu'un bloc du fil saura défaire (M10.10) — branché par la tranche 2. */
export type Annulation = { type: "tache"; id: string };

export type SortieOutil =
  | { type: "affaires"; titre: string; affaires: SubjectRowData[] }
  | {
      type: "affaire";
      affaire: SubjectRowData;
      /** La fiche en texte structuré, pour le modèle. */
      fiche: string;
      taches: TaskItemData[];
    }
  | { type: "taches"; titre: string; taches: TaskItemData[] }
  | { type: "indicateurs"; lignes: { libelle: string; valeur: number }[] }
  | { type: "contacts"; contacts: ContactLigne[] }
  | { type: "contact"; contact: ContactLigne; affaires: SubjectRowData[] }
  | { type: "tache-creee"; tache: TaskItemData; annulation: Annulation }
  | { type: "introuvable"; message: string }
  | { type: "erreur"; message: string };

export type ContexteOutils = {
  now: Date;
  /** La page d'origine : l'affaire ouverte, par défaut de toute désignation. */
  subjectId: string | null;
  /** Appelé dès qu'un outil a ÉCRIT : la route invalide le cache de données. */
  onEcriture?: () => void;
};

const designation = {
  reference: z
    .string()
    .nullable()
    .describe(
      "La référence de l'affaire (« SUB-0142 »), si le dirigeant la donne.",
    ),
  titre: z
    .string()
    .nullable()
    .describe(
      "Un bout du titre de l'affaire, sinon. Null pour l'affaire de la page ouverte.",
    ),
};

function erreur(e: unknown): SortieOutil {
  if (isDomainError(e)) return { type: "erreur", message: e.message };
  throw e;
}

function contactLigne(c: {
  id: string;
  firstName: string | null;
  lastName: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}): ContactLigne {
  return {
    id: c.id,
    nom: c.firstName ? `${c.firstName} ${c.lastName}` : c.lastName,
    entreprise: c.company,
    role: c.role,
    email: c.email,
    telephone: c.phone,
  };
}

export function outilsRelvo(db: TenantDb, ctx: ContexteOutils) {
  /** L'affaire désignée, ou celle de la page ; null et un message sinon. */
  async function affaire(args: {
    reference: string | null;
    titre: string | null;
  }): Promise<{ id: string } | { message: string }> {
    if (!args.reference && !args.titre) {
      if (ctx.subjectId) return { id: ctx.subjectId };
      return { message: "Aucune affaire désignée : demander laquelle." };
    }
    const trouve = await resolveSubject(db, args);
    return (
      trouve ?? { message: "Aucune affaire ne correspond : demander laquelle." }
    );
  }

  async function lignesAffaires(ids: string[]): Promise<SubjectRowData[]> {
    if (ids.length === 0) return [];
    const rows = await db.subject.findMany({ where: { id: { in: ids } } });
    const parId = new Map(rows.map((r) => [r.id, r]));
    const ordonnes = ids.map((id) => parId.get(id)).filter((r) => r != null);
    return (await enrichSubjects(db, ordonnes)).map(toSubjectRowData);
  }

  return {
    list_subjects: tool({
      description:
        "Liste les affaires du dirigeant : ouvertes, urgentes, en attente d'une réponse. À utiliser pour « qu'est-ce qui est urgent », « mes affaires », « qu'est-ce qui attend ».",
      inputSchema: z.object({
        filtre: z
          .enum(["ouvertes", "urgentes", "en_attente", "a_trier"])
          .describe(
            "ouvertes = toutes les affaires en cours ; urgentes ; en_attente = celles qui attendent une réponse du dirigeant ou d'un tiers ; a_trier = aucune, le compte des conversations sans affaire.",
          ),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({ filtre, limite }): Promise<SortieOutil> => {
        try {
          const take = limite ?? 10;
          if (filtre === "a_trier") {
            const brief = await getBriefProjection(db, ctx.now);
            return {
              type: "indicateurs",
              lignes: [
                {
                  libelle: "Conversations à trier",
                  valeur: brief.conversationsATrier,
                },
              ],
            };
          }
          const rows = await db.subject.findMany({
            where: {
              status: "open",
              ...(filtre === "urgentes" ? { priority: "urgent" } : {}),
              ...(filtre === "en_attente" ? { waitingForReply: true } : {}),
            },
            orderBy: [{ priority: "desc" }, { lastActivityAt: "desc" }],
            take,
          });
          const titre =
            filtre === "urgentes"
              ? "Affaires urgentes"
              : filtre === "en_attente"
                ? "Affaires en attente"
                : "Affaires ouvertes";
          return {
            type: "affaires",
            titre,
            affaires: (await enrichSubjects(db, rows)).map(toSubjectRowData),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    get_subject: tool({
      description:
        "Lit la fiche d'une affaire : situation, résumé, tâches, contacts, derniers messages. À appeler avant de résumer, d'expliquer où en est une affaire, ou de répondre sur son contenu. Sans référence ni titre : l'affaire de la page ouverte.",
      inputSchema: z.object(designation),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const a = await affaire(args);
          if ("message" in a)
            return { type: "introuvable", message: a.message };
          const [sheet, rows, taches] = await Promise.all([
            loadSubjectSheet(db, a.id, { messages: 3 }),
            lignesAffaires([a.id]),
            listTasks(db, { subjectId: a.id, limit: 50 }),
          ]);
          const ouvertes = taches.items.filter((t) => t.status !== "deleted");
          return {
            type: "affaire",
            affaire: rows[0]!,
            fiche: ficheSujet(sheet.sujet, { messages: 3 }),
            taches: (await enrichTasks(db, ouvertes, ctx.now)).map(
              toTaskItemData,
            ),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    list_tasks: tool({
      description:
        "Liste les tâches du dirigeant : celles d'aujourd'hui, de la semaine, en retard, ou celles d'une affaire.",
      inputSchema: z.object({
        periode: z
          .enum(["aujourd_hui", "semaine", "en_retard", "affaire"])
          .describe(
            "affaire = les tâches d'une affaire désignée (référence ou titre), sinon celle de la page.",
          ),
        ...designation,
      }),
      execute: async ({ periode, ...args }): Promise<SortieOutil> => {
        try {
          if (periode === "affaire") {
            const a = await affaire(args);
            if ("message" in a)
              return { type: "introuvable", message: a.message };
            const page = await listTasks(db, { subjectId: a.id, limit: 50 });
            const ouvertes = page.items.filter((t) => t.status === "open");
            return {
              type: "taches",
              titre: "Tâches de l'affaire",
              taches: (await enrichTasks(db, ouvertes, ctx.now)).map(
                toTaskItemData,
              ),
            };
          }
          // Les mêmes bornes que l'agenda : le jour civil FRANÇAIS (#55).
          const debut = debutDuJourParis(ctx.now);
          const rows =
            periode === "en_retard"
              ? await getOverdueTasks(db, { now: ctx.now, limit: 30 })
              : await db.task.findMany({
                  where: {
                    status: "open",
                    startDate: {
                      gte: debut,
                      lt: jourDecale(ctx.now, periode === "semaine" ? 7 : 1),
                    },
                  },
                  orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
                  take: 30,
                });
          const titre =
            periode === "en_retard"
              ? "Tâches en retard"
              : periode === "semaine"
                ? "Tâches de la semaine"
                : "Tâches d'aujourd'hui";
          return {
            type: "taches",
            titre,
            taches: (await enrichTasks(db, rows, ctx.now)).map(toTaskItemData),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    get_kpis: tool({
      description:
        "Les compteurs du jour : affaires ouvertes, urgentes, tâches du jour, en retard, conversations à trier. Pour une question chiffrée.",
      inputSchema: z.object({}),
      execute: async (): Promise<SortieOutil> => {
        try {
          const b = await getBriefProjection(db, ctx.now);
          return {
            type: "indicateurs",
            lignes: [
              { libelle: "Affaires ouvertes", valeur: b.sujetsOuverts },
              { libelle: "Affaires urgentes", valeur: b.sujetsUrgents.length },
              { libelle: "Tâches aujourd'hui", valeur: b.tachesDuJour },
              { libelle: "Tâches en retard", valeur: b.tachesEnRetard },
              {
                libelle: "Conversations à trier",
                valeur: b.conversationsATrier,
              },
            ],
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    list_contacts: tool({
      description:
        "Cherche dans l'annuaire : par nom, entreprise ou adresse. Sans recherche, les contacts récents.",
      inputSchema: z.object({
        recherche: z.string().nullable(),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({ recherche, limite }): Promise<SortieOutil> => {
        try {
          const q = recherche?.trim();
          const rows = await db.contact.findMany({
            where: q
              ? {
                  OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { company: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : undefined,
            orderBy: { updatedAt: "desc" },
            take: limite ?? 10,
          });
          return { type: "contacts", contacts: rows.map(contactLigne) };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    get_contact: tool({
      description:
        "La fiche d'un contact et ses affaires ouvertes, par son nom.",
      inputSchema: z.object({ nom: z.string() }),
      execute: async ({ nom }): Promise<SortieOutil> => {
        try {
          const q = nom.trim();
          const c = await db.contact.findFirst({
            where: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { updatedAt: "desc" },
          });
          if (!c)
            return { type: "introuvable", message: `Aucun contact « ${q} ».` };
          const sujets = await db.subject.findMany({
            where: { status: "open", contactIds: { has: c.id } },
            orderBy: { lastActivityAt: "desc" },
            take: 10,
          });
          return {
            type: "contact",
            contact: contactLigne(c),
            affaires: (await enrichSubjects(db, sujets)).map(toSubjectRowData),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    create_task: tool({
      description:
        "Crée une tâche pour le dirigeant — ou un RENDEZ-VOUS, qui est une tâche avec une date et une heure. Rattachée à une affaire si elle est désignée ou si la page en ouvre une ; sinon sans affaire. Les dates et heures sont en heure française, telles que le dirigeant les dit.",
      inputSchema: z.object({
        titre: z
          .string()
          .describe("Court, à l'infinitif : « Rappeler le plombier »."),
        date: z
          .string()
          .nullable()
          .describe(
            "AAAA-MM-JJ, calculée depuis la date du jour ; null sans date dite.",
          ),
        heure: z
          .string()
          .nullable()
          .describe("HH:MM en heure française ; null sans heure dite."),
        heure_fin: z
          .string()
          .nullable()
          .describe("HH:MM, si une fin est dite."),
        type: z
          .enum(TYPES_TACHE)
          .nullable()
          .describe(
            "call = appeler, reply = répondre, decision, check = vérifier, follow_up = relancer, inform, other.",
          ),
        description: z.string().nullable(),
        affaire_reference: designation.reference,
        affaire_titre: designation.titre,
      }),
      execute: async ({
        affaire_reference: reference,
        affaire_titre: titreAffaire,
        ...args
      }): Promise<SortieOutil> => {
        try {
          let subjectId: string | null = ctx.subjectId;
          if (reference || titreAffaire) {
            const a = await resolveSubject(db, {
              reference,
              titre: titreAffaire,
            });
            if (!a) {
              return {
                type: "introuvable",
                message:
                  "Aucune affaire ne correspond : demander laquelle, ou créer la tâche sans affaire.",
              };
            }
            subjectId = a.id;
          }
          const task = await createTask(
            db,
            versCreateTaskInput(args, subjectId),
          );
          ctx.onEcriture?.();
          const [tache] = await enrichTasks(db, [task], ctx.now);
          return {
            type: "tache-creee",
            tache: toTaskItemData(tache!),
            annulation: { type: "tache", id: task.id },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),
  } satisfies ToolSet;
}

export type OutilsRelvo = ReturnType<typeof outilsRelvo>;
export type OutilsRelvoUI = InferUITools<OutilsRelvo>;

/** Le message de l'interface, typé par la palette : le fil sait quel outil a rendu quoi. */
export type RelvoUIMessage = UIMessage<unknown, UIDataTypes, OutilsRelvoUI>;
