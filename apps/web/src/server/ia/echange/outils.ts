import {
  tool,
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  completeTask,
  createNote,
  createSubject,
  createTask,
  debutDuJourParis,
  deleteNote,
  deleteTask,
  enrichSubjects,
  enrichTasks,
  getBriefProjection,
  getOverdueTasks,
  isDomainError,
  jourDecale,
  listFolders,
  listTasks,
  loadSubjectSheet,
  resolveSubject,
  searchMessages,
  updateNote,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
  updateTask,
  type Annulation,
  type MessageTrouve,
  type Origine,
  type TacheSnapshot,
  type Task,
  type TenantDb,
} from "@relvo/db";
import {
  type SubjectRowData,
  toSubjectRowData,
} from "@/components/shared/subject-row";
import { type TaskItemData, toTaskItemData } from "@/lib/task-item-data";
import { preparerBrouillon } from "../pipeline/brouillon";
import { ficheSujet } from "../contexte";
import {
  DATE_NUE,
  dateNueVersDate,
  HEURE_NUE,
  heureNue,
  TYPES_TACHE,
  versCreateTaskInput,
} from "./conversions";

// Les OUTILS de Relvo dans l'échange (M10.8, `05 §11.6`) — la palette entière :
// la lecture, et chaque geste d'écriture de l'interface. Chaque outil
// enveloppe UNE fonction du domaine — jamais une server action, jamais une
// règle réécrite — et rend une PROJECTION PRÊTE POUR L'ÉCRAN : le fil affiche
// une affaire avec la ligne d'affaire, une tâche avec la ligne de tâche
// (01 §11, invariant 31), jamais une liste à puces.
//
// Un geste d'écriture porte sa PROVENANCE (`source: "chat"`, M10.13) dans le
// journal que la fonction écrit déjà, et son descripteur d'ANNULATION
// (M10.10) : ce que « Annuler » défera, par la même fonction que l'écran.
// L'acteur est le dirigeant : la tâche qu'il dicte est la sienne, Relvo n'est
// que la main.
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
  | { type: "messages"; messages: MessageTrouve[] }
  // Les gestes — une phrase signée ✦, l'objet rendu, et ce que « Annuler » défait.
  | { type: "tache-creee"; tache: TaskItemData; annulation: Annulation }
  | { type: "tache-modifiee"; tache: TaskItemData; annulation: Annulation }
  | { type: "tache-cochee"; tache: TaskItemData; annulation: Annulation }
  | { type: "tache-supprimee"; titre: string; annulation: Annulation }
  | { type: "affaire-creee"; affaire: SubjectRowData; annulation: Annulation }
  | {
      type: "affaire-modifiee";
      affaire: SubjectRowData;
      /** « validée », « rouverte », « marquée urgente », « résumé mis à jour »… */
      geste: string;
      annulation: Annulation;
    }
  | {
      type: "brouillon";
      contact: string;
      conversationId: string;
      taskId: string;
      extrait: string;
      sources: string[];
      annulation: Annulation;
    }
  | {
      type: "note";
      geste: "créée" | "modifiée" | "supprimée";
      titre: string;
      domaine: string;
      folderId: string;
      annulation: Annulation;
    }
  | { type: "introuvable"; message: string }
  | { type: "erreur"; message: string };

export type ContexteOutils = {
  accountId: string;
  now: Date;
  /** La page d'origine : l'affaire ouverte, par défaut de toute désignation. */
  subjectId: string | null;
  /** Appelé dès qu'un outil a ÉCRIT : la route invalide le cache de données. */
  onEcriture?: () => void;
};

const CHAT: Origine = { source: "chat" };

const designation = {
  reference: z
    .string()
    .nullable()
    .describe(
      "La référence de l'affaire (« SUB-00142 »), si le dirigeant la donne.",
    ),
  titre: z
    .string()
    .nullable()
    .describe(
      "Un bout du titre de l'affaire, sinon. Null pour l'affaire de la page ouverte.",
    ),
};

const designationTache = {
  tache_id: z
    .string()
    .nullable()
    .describe(
      "L'identifiant de la tâche, s'il est connu d'un résultat précédent.",
    ),
  tache_titre: z
    .string()
    .nullable()
    .describe(
      "Sinon, un bout de son titre ; cherchée parmi les tâches ouvertes de l'affaire désignée ou de la page.",
    ),
};

function erreur(e: unknown): SortieOutil {
  if (isDomainError(e)) return { type: "erreur", message: e.message };
  throw e;
}

function introuvable(message: string): SortieOutil {
  return { type: "introuvable", message };
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

/** Ce qu'il faut pour remettre une tâche comme elle était (annulation). */
export function snapshotTache(t: Task): TacheSnapshot {
  return {
    subjectId: t.subjectId,
    title: t.title,
    description: t.description,
    kind: t.kind,
    startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
    startTime: t.startTime ? t.startTime.toISOString().slice(11, 16) : null,
    endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
    endTime: t.endTime ? t.endTime.toISOString().slice(11, 16) : null,
  };
}

export function outilsRelvo(db: TenantDb, ctx: ContexteOutils) {
  const a = () => ctx.now.toISOString();
  const ecrit = () => ctx.onEcriture?.();

  /** L'affaire désignée, ou celle de la page ; un message sinon. */
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

  async function ligneTache(task: Task): Promise<TaskItemData> {
    const [t] = await enrichTasks(db, [task], ctx.now);
    return toTaskItemData(t!);
  }

  /** La tâche désignée : par identifiant, sinon par titre parmi les ouvertes de l'affaire. */
  async function tache(args: {
    tache_id: string | null;
    tache_titre: string | null;
    reference: string | null;
    titre: string | null;
  }): Promise<Task | { message: string }> {
    if (args.tache_id) {
      const t = await db.task.findFirst({ where: { id: args.tache_id } });
      if (t) return t;
    }
    const q = args.tache_titre?.trim();
    if (!q) return { message: "Aucune tâche désignée : demander laquelle." };
    const cible =
      args.reference || args.titre || ctx.subjectId
        ? await affaire(args)
        : null;
    const subjectId = cible && "id" in cible ? cible.id : undefined;
    const t = await db.task.findFirst({
      where: {
        status: "open",
        title: { contains: q, mode: "insensitive" },
        ...(subjectId ? { subjectId } : {}),
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    });
    return (
      t ?? { message: `Aucune tâche ouverte « ${q} » : demander laquelle.` }
    );
  }

  async function domaine(nom: string | null) {
    const folders = await listFolders(db);
    const q = nom?.trim().toLowerCase();
    return (
      (q
        ? (folders.find((f) => f.name.toLowerCase() === q) ??
          folders.find((f) => f.name.toLowerCase().includes(q)))
        : null) ??
      folders.find((f) => f.isDefault) ??
      null
    );
  }

  async function contact(nom: string) {
    const q = nom.trim();
    return db.contact.findFirst({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async function note(titre: string) {
    return db.knowledgeDocument.findFirst({
      where: {
        kind: "note",
        name: { contains: titre.trim(), mode: "insensitive" },
      },
      include: { folder: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  return {
    // ── Lecture ──────────────────────────────────────────────────────────
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
          const cible = await affaire(args);
          if ("message" in cible) return introuvable(cible.message);
          const [sheet, rows, taches] = await Promise.all([
            loadSubjectSheet(db, cible.id, { messages: 3 }),
            lignesAffaires([cible.id]),
            listTasks(db, { subjectId: cible.id, limit: 50 }),
          ]);
          const vivantes = taches.items.filter((t) => t.status !== "deleted");
          return {
            type: "affaire",
            affaire: rows[0]!,
            fiche: ficheSujet(sheet.sujet, { messages: 3 }),
            taches: (await enrichTasks(db, vivantes, ctx.now)).map(
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
        "Liste les tâches du dirigeant : celles d'aujourd'hui, de la semaine, en retard, ou celles d'une affaire. Les identifiants rendus servent à modifier, cocher ou supprimer une tâche ensuite.",
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
            const cible = await affaire(args);
            if ("message" in cible) return introuvable(cible.message);
            const page = await listTasks(db, {
              subjectId: cible.id,
              limit: 50,
            });
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
          const c = await contact(nom);
          if (!c) return introuvable(`Aucun contact « ${nom.trim()} ».`);
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

    search_messages: tool({
      description:
        "Cherche dans les messages reçus et envoyés : un mot de l'objet, du texte ou le nom de l'expéditeur. Rend les plus récents. Pour « qu'a dit X à propos de Y », « retrouve le mail sur… ».",
      inputSchema: z.object({
        recherche: z.string(),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({ recherche, limite }): Promise<SortieOutil> => {
        try {
          return {
            type: "messages",
            messages: await searchMessages(db, {
              recherche,
              limite: limite ?? 10,
            }),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    // ── Tâches ───────────────────────────────────────────────────────────
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
            const s = await resolveSubject(db, {
              reference,
              titre: titreAffaire,
            });
            if (!s) {
              return introuvable(
                "Aucune affaire ne correspond : demander laquelle, ou créer la tâche sans affaire.",
              );
            }
            subjectId = s.id;
          }
          const task = await createTask(
            db,
            versCreateTaskInput(args, subjectId),
            CHAT,
          );
          ecrit();
          return {
            type: "tache-creee",
            tache: await ligneTache(task),
            annulation: { type: "tache", id: task.id, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    update_task: tool({
      description:
        "Modifie une tâche : son titre, sa date, son heure (déplacer un rendez-vous), ou retire sa date. Ce qui n'est pas donné ne change pas.",
      inputSchema: z.object({
        ...designationTache,
        ...designation,
        nouveau_titre: z.string().nullable(),
        date: z.string().nullable().describe("AAAA-MM-JJ ; null = inchangée."),
        heure: z.string().nullable().describe("HH:MM ; null = inchangée."),
        heure_fin: z.string().nullable(),
        retirer_date: z
          .boolean()
          .nullable()
          .describe(
            "true pour retirer la date et l'heure : la tâche devient flottante.",
          ),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const t = await tache(args);
          if ("message" in t) return introuvable(t.message);
          const avant = snapshotTache(t);
          const date =
            args.date && DATE_NUE.test(args.date) ? args.date : avant.startDate;
          const heure =
            args.heure && HEURE_NUE.test(args.heure)
              ? args.heure
              : avant.startTime;
          const fin =
            args.heure_fin && HEURE_NUE.test(args.heure_fin)
              ? args.heure_fin
              : avant.endTime;
          const retirer = args.retirer_date === true;
          const apres = await updateTask(
            db,
            t.id,
            {
              ...(args.nouveau_titre?.trim()
                ? { title: args.nouveau_titre.trim() }
                : {}),
              startDate: retirer ? null : dateNueVersDate(date),
              startTime: retirer ? null : heureNue(date, heure),
              endDate: null,
              endTime: retirer ? null : heureNue(date, fin),
            },
            CHAT,
          );
          ecrit();
          return {
            type: "tache-modifiee",
            tache: await ligneTache(apres),
            annulation: {
              type: "tache-modifiee",
              id: t.id,
              precedent: avant,
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    mark_task_done: tool({
      description:
        "Coche une tâche : le dirigeant dit qu'elle est faite. La dernière tâche cochée d'une affaire peut la régler.",
      inputSchema: z.object({ ...designationTache, ...designation }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const t = await tache(args);
          if ("message" in t) return introuvable(t.message);
          const faite = await completeTask(db, t.id, "user", undefined, CHAT);
          ecrit();
          return {
            type: "tache-cochee",
            tache: await ligneTache(faite),
            annulation: { type: "tache-cochee", id: t.id, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    mark_task_deleted: tool({
      description:
        "Supprime une tâche que le dirigeant ne veut plus voir. Seulement sur demande explicite.",
      inputSchema: z.object({ ...designationTache, ...designation }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const t = await tache(args);
          if ("message" in t) return introuvable(t.message);
          const avant = snapshotTache(t);
          await deleteTask(db, t.id, CHAT);
          ecrit();
          return {
            type: "tache-supprimee",
            titre: t.title,
            annulation: { type: "tache-supprimee", precedent: avant, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    // ── Affaires ─────────────────────────────────────────────────────────
    create_subject: tool({
      description:
        "Ouvre une affaire à la demande du dirigeant : un titre court orienté métier, un domaine du compte s'il convient, un contact connu s'il est nommé, un résumé d'une phrase.",
      inputSchema: z.object({
        titre: z.string(),
        domaine: z
          .string()
          .nullable()
          .describe("Le nom d'un domaine du compte, ou null."),
        contact: z
          .string()
          .nullable()
          .describe("Le nom d'un contact de l'annuaire, ou null."),
        resume: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const f = args.domaine ? await domaine(args.domaine) : null;
          const c = args.contact ? await contact(args.contact) : null;
          const s = await createSubject(
            db,
            {
              title: args.titre.trim(),
              summary: args.resume?.trim() || null,
              // « Général » ne contient jamais d'affaire (invariant 17).
              folderId: f && !f.isDefault ? f.id : null,
              contactIds: c ? [c.id] : [],
            },
            CHAT,
          );
          ecrit();
          return {
            type: "affaire-creee",
            affaire: (await lignesAffaires([s.id]))[0]!,
            annulation: { type: "affaire", id: s.id, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    update_subject_status: tool({
      description:
        "Change l'état d'une affaire à la demande du dirigeant : validee = le travail est fait ; fermee = on la range sans la valider ; rouverte = elle repart. Jamais de ta propre initiative.",
      inputSchema: z.object({
        ...designation,
        statut: z.enum(["validee", "fermee", "rouverte"]),
      }),
      execute: async ({ statut, ...args }): Promise<SortieOutil> => {
        try {
          const cible = await affaire(args);
          if ("message" in cible) return introuvable(cible.message);
          const avant = await db.subject.findFirst({
            where: { id: cible.id },
            select: { status: true },
          });
          const status =
            statut === "validee"
              ? "validated"
              : statut === "fermee"
                ? "closed"
                : "open";
          await updateSubjectStatus(db, cible.id, status, "user", CHAT);
          ecrit();
          return {
            type: "affaire-modifiee",
            affaire: (await lignesAffaires([cible.id]))[0]!,
            geste:
              statut === "validee"
                ? "validée"
                : statut === "fermee"
                  ? "fermée"
                  : "rouverte",
            annulation: {
              type: "statut",
              id: cible.id,
              precedent: avant?.status ?? "open",
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    update_subject_priority: tool({
      description:
        "Marque une affaire urgente, ou lui retire l'urgence. L'urgent est rare : seulement à la demande du dirigeant.",
      inputSchema: z.object({ ...designation, urgent: z.boolean() }),
      execute: async ({ urgent, ...args }): Promise<SortieOutil> => {
        try {
          const cible = await affaire(args);
          if ("message" in cible) return introuvable(cible.message);
          const avant = await db.subject.findFirst({
            where: { id: cible.id },
            select: { priority: true },
          });
          await updateSubjectPriority(
            db,
            cible.id,
            urgent ? "urgent" : "normal",
            "user",
            CHAT,
          );
          ecrit();
          return {
            type: "affaire-modifiee",
            affaire: (await lignesAffaires([cible.id]))[0]!,
            geste: urgent ? "marquée urgente" : "plus urgente",
            annulation: {
              type: "priorite",
              id: cible.id,
              precedent: avant?.priority ?? "normal",
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    update_subject_summary: tool({
      description:
        "Récrit le résumé d'une affaire (une à deux phrases : de quoi il s'agit), à la demande du dirigeant ou quand il te dicte une précision à retenir sur l'affaire.",
      inputSchema: z.object({ ...designation, resume: z.string() }),
      execute: async ({ resume, ...args }): Promise<SortieOutil> => {
        try {
          const cible = await affaire(args);
          if ("message" in cible) return introuvable(cible.message);
          const avant = await db.subject.findFirst({
            where: { id: cible.id },
            select: { summary: true },
          });
          await updateSubject(db, cible.id, { summary: resume.trim() }, CHAT);
          ecrit();
          return {
            type: "affaire-modifiee",
            affaire: (await lignesAffaires([cible.id]))[0]!,
            geste: "résumé mis à jour",
            annulation: {
              type: "resume",
              id: cible.id,
              precedent: avant?.summary ?? null,
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    // ── Brouillon ────────────────────────────────────────────────────────
    create_message_draft: tool({
      description:
        "Prépare un brouillon de réponse au contact d'une affaire : il se dépose dans la conversation, le dirigeant l'envoie lui-même — rien n'est envoyé. Sur une tâche de réponse ouverte de l'affaire, sinon sur une tâche de réponse créée avec la consigne.",
      inputSchema: z.object({
        ...designation,
        consigne: z
          .string()
          .nullable()
          .describe(
            "Ce que la réponse doit dire, en une phrase : « relancer sur la livraison », « accepter le devis ».",
          ),
      }),
      execute: async ({ consigne, ...args }): Promise<SortieOutil> => {
        try {
          const cible = await affaire(args);
          if ("message" in cible) return introuvable(cible.message);
          const ouverte = await db.task.findFirst({
            where: {
              subjectId: cible.id,
              status: "open",
              kind: { in: ["reply", "decision"] },
            },
            orderBy: [{ createdAt: "desc" }],
          });
          const t =
            ouverte ??
            (await createTask(
              db,
              {
                subjectId: cible.id,
                title: consigne?.trim()
                  ? `Répondre : ${consigne.trim()}`
                  : "Répondre au contact",
                kind: "reply",
                sourceActor: "user",
              },
              CHAT,
            ));
          ecrit();
          const r = await preparerBrouillon({
            accountId: ctx.accountId,
            taskId: t.id,
          });
          if (r.issue !== "redige" && r.issue !== "reutilise") {
            const motif =
              r.issue === "decisions-en-attente"
                ? "Cette réponse attend d'abord une décision du dirigeant, dans la conversation."
                : r.issue === "desactive" ||
                    r.issue === "inference-indisponible"
                  ? "Je ne peux pas rédiger pour l'instant."
                  : "Je n'ai pas pu rédiger ce brouillon : aucune conversation ne porte cette affaire, ou la rédaction a échoué.";
            return { type: "erreur", message: motif };
          }
          const [conversationId, sujet] = await Promise.all([
            db.action
              .findFirst({
                where: { id: r.actionId },
                select: { payload: true },
              })
              .then((x) => {
                const p = x?.payload as { conversationId?: string } | null;
                return p?.conversationId ?? null;
              }),
            db.subject.findFirst({
              where: { id: cible.id },
              select: { contactIds: true },
            }),
          ]);
          const c = sujet?.contactIds[0]
            ? await db.contact.findFirst({ where: { id: sujet.contactIds[0] } })
            : null;
          if (!conversationId) {
            return {
              type: "erreur",
              message:
                "Le brouillon est prêt mais aucune conversation ne le porte.",
            };
          }
          return {
            type: "brouillon",
            contact: c ? contactLigne(c).nom : "le contact",
            conversationId,
            taskId: t.id,
            extrait:
              r.contenu.length > 280
                ? `${r.contenu.slice(0, 280)}…`
                : r.contenu,
            sources: r.sources,
            annulation: { type: "brouillon", actionId: r.actionId, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    // ── Mémoire ──────────────────────────────────────────────────────────
    create_knowledge_note: tool({
      description:
        "Écrit une instruction dans la Mémoire de Relvo, à la demande du dirigeant : une règle qu'il veut que tu appliques (« les devis au-dessus de 5 000 € passent par moi »). Dans un domaine du compte, sinon dans « Général ».",
      inputSchema: z.object({
        titre: z.string(),
        contenu: z.string(),
        domaine: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const f = await domaine(args.domaine);
          if (!f)
            return {
              type: "erreur",
              message: "Aucun domaine pour accueillir l'instruction.",
            };
          const n = await createNote(
            db,
            {
              folderId: f.id,
              name: args.titre.trim(),
              content: args.contenu.trim(),
            },
            CHAT,
          );
          ecrit();
          return {
            type: "note",
            geste: "créée",
            titre: n.name,
            domaine: f.name,
            folderId: f.id,
            annulation: { type: "note", id: n.id, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    update_knowledge_note: tool({
      description:
        "Modifie une instruction de la Mémoire, désignée par son titre : nouveau titre ou nouveau contenu.",
      inputSchema: z.object({
        titre: z.string().describe("Le titre actuel, ou un bout."),
        nouveau_titre: z.string().nullable(),
        contenu: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const n = await note(args.titre);
          if (!n)
            return introuvable(`Aucune instruction « ${args.titre.trim()} ».`);
          const precedent = { name: n.name, content: n.content };
          const apres = await updateNote(
            db,
            n.id,
            {
              ...(args.nouveau_titre?.trim()
                ? { name: args.nouveau_titre.trim() }
                : {}),
              ...(args.contenu !== null
                ? { content: args.contenu.trim() }
                : {}),
            },
            CHAT,
          );
          ecrit();
          return {
            type: "note",
            geste: "modifiée",
            titre: apres.name,
            domaine: n.folder.name,
            folderId: n.folder.id,
            annulation: { type: "note-modifiee", id: n.id, precedent, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    delete_knowledge_note: tool({
      description:
        "Supprime une instruction de la Mémoire, désignée par son titre. Seulement sur demande explicite.",
      inputSchema: z.object({ titre: z.string() }),
      execute: async ({ titre }): Promise<SortieOutil> => {
        try {
          const n = await note(titre);
          if (!n) return introuvable(`Aucune instruction « ${titre.trim()} ».`);
          await deleteNote(db, n.id, CHAT);
          ecrit();
          return {
            type: "note",
            geste: "supprimée",
            titre: n.name,
            domaine: n.folder.name,
            folderId: n.folder.id,
            annulation: {
              type: "note-supprimee",
              precedent: {
                folderId: n.folderId,
                name: n.name,
                content: n.content,
              },
              a: a(),
            },
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
