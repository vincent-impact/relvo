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
  contactDisplayName,
  createNote,
  createSubject,
  createTask,
  deleteNote,
  deleteTask,
  enrichSubjects,
  enrichTasks,
  getBriefProjection,
  horodatageParis,
  isDomainError,
  listConversationItems,
  listFolders,
  listTasks,
  loadSubjectSheet,
  resolveSubject,
  searchKnowledge,
  searchMessages,
  searchSubjects,
  searchTasks,
  updateNote,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
  updateTask,
  type Annulation,
  type ConnaissanceTrouvee,
  type Contact,
  type MessageTrouve,
  type Origine,
  type TacheSnapshot,
  type Task,
  type TenantDb,
  cheminDe,
  createFolder,
  type FolderNode,
  listFolderOptions,
  loadFolderTree,
  moveFolder,
  resoudreDossier,
} from "@relvo/db";
import {
  type SubjectRowData,
  toSubjectRowData,
} from "@/components/shared/subject-row";
import { type TaskItemData, toTaskItemData } from "@/lib/task-item-data";
import type { ResultatBrouillon } from "../pipeline/brouillon";
import { instantDebutJourParis, instantFinJourParis } from "@relvo/db/temps";
import { ficheSujet } from "../contexte";
import {
  bornesPeriode,
  DATE_NUE,
  dateNueVersDate,
  HEURE_NUE,
  heureNue,
  PERIODES_TACHES,
  titreTaches,
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
//
// Un outil de LECTURE prend les critères que le dirigeant dit — un jour, une
// personne, un domaine, un canal, un état — jamais seulement un mot-clé
// (PITFALLS #68) : à filtres figés, le modèle invente un mot (« 2026-10-19 »,
// « email »), ne trouve rien, et le dit. Chaque critère réduit ce qui remonte.
// Un nom qui désigne PLUSIEURS contacts n'est jamais tranché en silence :
// l'outil rend les candidats, le modèle demande.

export type ContactLigne = {
  id: string;
  nom: string;
  entreprise: string | null;
  role: string | null;
  email: string | null;
  telephone: string | null;
};

export type ConversationLigne = {
  id: string;
  titre: string;
  canal: "email" | "whatsapp";
  interlocuteur: string | null;
  /** Heure française « AAAA-MM-JJ HH:MM », ou null. */
  dernierMessageLe: string | null;
  apercu: string;
  nonLus: number;
  /** Les affaires qui écoutent encore ce fil. */
  affaires: string[];
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
  | {
      type: "contacts";
      contacts: ContactLigne[];
      /** Posée quand un nom désigne plusieurs contacts : le modèle demande lequel. */
      precision?: string;
    }
  | { type: "contact"; contact: ContactLigne; affaires: SubjectRowData[] }
  | { type: "messages"; messages: MessageTrouve[] }
  | {
      type: "conversations";
      titre: string;
      conversations: ConversationLigne[];
    }
  | { type: "memoire"; connaissances: ConnaissanceTrouvee[] }
  /** La lecture du courrier récent (M7.19), une ligne par boîte — rendue en carte vivante. */
  | { type: "lecture"; lectures: LectureLigne[] }
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
  /** Les dossiers du compte, en ordre d'arbre, avec leur chemin (M23.7). */
  | { type: "dossiers"; dossiers: DossierLigne[] }
  /** Un dossier créé ou déplacé, une affaire rangée. */
  | {
      type: "dossier";
      geste: "créé" | "déplacé";
      nom: string;
      chemin: string;
      folderId: string;
      annulation: Annulation;
    }
  | { type: "introuvable"; message: string }
  | { type: "erreur"; message: string };

/** Un dossier tel que l'échange le liste. */
export type DossierLigne = {
  id: string;
  nom: string;
  chemin: string;
  profondeur: number;
  affairesOuvertes: number;
};

/** Une lecture du courrier récent, telle que la carte vivante la rend. */
export type LectureLigne = {
  boite: string;
  status: string;
  messagesImported: number;
  messagesTriaged: number;
  subjectsOpened: number;
  conversationsIgnored: number;
  candidatesTotal: number | null;
  importDone: boolean;
  stopReason: string | null;
  /** Le jour de la demande, en heure française. */
  demandeeLe: string;
};

export type ContexteOutils = {
  accountId: string;
  now: Date;
  /** La page d'origine : l'affaire ouverte, par défaut de toute désignation. */
  subjectId: string | null;
  /**
   * La rédaction d'un brouillon (M7.7), INJECTÉE : la route passe le pipeline
   * (`preparerBrouillon`), le jeu d'évaluation un simulacre — ce module reste
   * importable hors Next.
   */
  brouillon: (taskId: string) => Promise<ResultatBrouillon>;
  /** Appelé dès qu'un outil a ÉCRIT : la route invalide le cache de données. */
  onEcriture?: () => void;
};

/** Ce que le serveur attache à un message de Relvo : le tier du tour, et ce qui l'a arrêté avant la fin. */
export type MetaRelvo = {
  tier?: "extraction" | "raisonnement";
  arret?: "plafond" | "longueur";
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

  /** Le dossier nommé, sinon « Général » — pour y ÉCRIRE une instruction. */
  async function domaine(nom: string | null) {
    return (
      (await domaineNomme(nom)) ??
      (await listFolders(db)).find((f) => f.isDefault) ??
      null
    );
  }

  /**
   * Le dossier que le dirigeant dit — un chemin, ou un nom quand il est seul à
   * le porter —, ou null : un repli silencieux fausserait la réponse, et un nom
   * porté par plusieurs dossiers se demande (PITFALLS #68, `dossierDit`).
   */
  async function domaineNomme(nom: string | null) {
    const q = nom?.trim();
    if (!q) return null;
    if (q.toLowerCase() === "général" || q.toLowerCase() === "general") {
      return (await listFolders(db)).find((f) => f.isDefault) ?? null;
    }
    return resoudreDossier(await loadFolderTree(db), q).dossier;
  }

  /** Le dossier dit, ou le message qui demande lequel : introuvable, ou plusieurs. */
  async function dossierDit(
    nom: string,
  ): Promise<{ dossier: FolderNode } | { message: string }> {
    const tree = await loadFolderTree(db);
    const r = resoudreDossier(tree, nom);
    if (r.dossier) return { dossier: r.dossier };
    if (r.candidats.length > 1) {
      return {
        message: `Plusieurs dossiers s'appellent « ${nom.trim()} » : ${r.candidats
          .map((c) => cheminDe(tree, c.id))
          .join(" ; ")}. Demander lequel.`,
      };
    }
    return {
      message: `Aucun dossier « ${nom.trim()} ». Les dossiers : ${await nomsDesDomaines()}.`,
    };
  }

  async function nomsDesDomaines(): Promise<string> {
    return (await listFolderOptions(db)).map((f) => f.path).join(", ");
  }

  async function lignesDossiers(): Promise<DossierLigne[]> {
    const [options, ouverts] = await Promise.all([
      listFolderOptions(db),
      db.subject.groupBy({
        by: ["folderId"],
        where: { status: "open" },
        _count: { _all: true },
      }),
    ]);
    const parDossier = new Map(ouverts.map((g) => [g.folderId, g._count._all]));
    return options.map((o) => ({
      id: o.id,
      nom: o.name,
      chemin: o.path,
      profondeur: o.depth,
      // Les affaires du dossier et de ses fils : sa portée.
      affairesOuvertes: options
        .filter((x) => x.id === o.id || x.chainIds.includes(o.id))
        .reduce((n, x) => n + (parDossier.get(x.id) ?? 0), 0),
    }));
  }

  /**
   * Les contacts qu'une désignation peut viser : chaque mot du nom dans le
   * prénom, le nom ou l'entreprise (« Karim Benali » trouve Karim Benali,
   * pas tous les Karim), une adresse, une entreprise. Les plus récents d'abord.
   */
  async function contactsCandidats(args: {
    nom?: string | null;
    email?: string | null;
    entreprise?: string | null;
  }): Promise<Contact[]> {
    const mots = (args.nom ?? "")
      .trim()
      .split(/\s+/)
      .filter((m) => m.length > 1);
    const email = args.email?.trim() || null;
    const entreprise = args.entreprise?.trim() || null;
    if (mots.length === 0 && !email && !entreprise) return [];
    return db.contact.findMany({
      where: {
        AND: [
          ...mots.map((mot) => ({
            OR: [
              { firstName: { contains: mot, mode: "insensitive" as const } },
              { lastName: { contains: mot, mode: "insensitive" as const } },
              { company: { contains: mot, mode: "insensitive" as const } },
            ],
          })),
          ...(email
            ? [
                {
                  OR: [
                    {
                      email: { contains: email, mode: "insensitive" as const },
                    },
                    { additionalEmails: { has: email.toLowerCase() } },
                  ],
                },
              ]
            : []),
          ...(entreprise
            ? [
                {
                  company: {
                    contains: entreprise,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });
  }

  /**
   * UN contact, ou ce qui empêche de le choisir : aucun, ou plusieurs — un
   * nom complet qui correspond exactement à un seul candidat tranche.
   */
  async function contactUnique(args: {
    nom?: string | null;
    email?: string | null;
    entreprise?: string | null;
  }): Promise<
    | { contact: Contact }
    | { contact: null; candidats: Contact[]; message: string }
  > {
    const candidats = await contactsCandidats(args);
    if (candidats.length === 1) return { contact: candidats[0]! };
    const nom = args.nom?.trim().toLowerCase();
    const exacts = nom
      ? candidats.filter((c) => contactDisplayName(c).toLowerCase() === nom)
      : [];
    if (exacts.length === 1) return { contact: exacts[0]! };
    if (candidats.length === 0) {
      const dit = args.nom ?? args.email ?? args.entreprise ?? "";
      return {
        contact: null,
        candidats,
        message: `Aucun contact « ${dit.trim()} ».`,
      };
    }
    return {
      contact: null,
      candidats,
      message: `Plusieurs contacts correspondent : ${candidats
        .map(
          (c) => contactDisplayName(c) + (c.company ? ` (${c.company})` : ""),
        )
        .join(", ")}. Demander lequel.`,
    };
  }

  /** Une instruction, par son titre d'abord, sinon par son contenu. */
  async function note(titre: string) {
    const q = titre.trim();
    const include = { folder: { select: { id: true, name: true } } };
    return (
      (await db.knowledgeDocument.findFirst({
        where: { kind: "note", name: { contains: q, mode: "insensitive" } },
        include,
      })) ??
      (await db.knowledgeDocument.findFirst({
        where: {
          kind: "note",
          content: { contains: q, mode: "insensitive" },
        },
        include,
        orderBy: { updatedAt: "desc" },
      }))
    );
  }

  return {
    // ── Lecture ──────────────────────────────────────────────────────────
    list_subjects: tool({
      description:
        "Liste les affaires du dirigeant. `filtre` : urgentes, ou en_attente (celles qui attendent une réponse). `statut` : ouvertes (défaut), validees, fermees, toutes. `recherche` : des mots du titre ou du résumé. `domaine` : le chemin ou le nom d'un dossier du compte — un dossier compte avec tout ce qu'il contient. `contact` : le nom d'un contact (« mes affaires avec Karim »). `depuis` / `jusquAu` : des jours AAAA-MM-JJ en heure française sur la dernière activité (« ce qui a bougé cette semaine » ; la date du jour est dans le contexte). Sans critère : les affaires ouvertes, urgentes d'abord. Ce qui est à trier : list_conversations.",
      inputSchema: z.object({
        filtre: z.enum(["urgentes", "en_attente"]).nullable(),
        statut: z
          .enum(["ouvertes", "validees", "fermees", "toutes"])
          .nullable(),
        recherche: z.string().nullable(),
        domaine: z.string().nullable(),
        contact: z.string().nullable(),
        depuis: z.string().regex(DATE_NUE).nullable(),
        jusquAu: z.string().regex(DATE_NUE).nullable(),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          let f: FolderNode | null = null;
          if (args.domaine) {
            const r = await dossierDit(args.domaine);
            if (!("dossier" in r)) return introuvable(r.message);
            f = r.dossier;
          }
          let contactId: string | null = null;
          if (args.contact) {
            const c = await contactUnique({ nom: args.contact });
            if (!c.contact) return introuvable(c.message);
            contactId = c.contact.id;
          }
          const rows = await searchSubjects(db, {
            recherche: args.recherche,
            statut: args.statut,
            urgentes: args.filtre === "urgentes",
            enAttente: args.filtre === "en_attente",
            folderId: f?.id ?? null,
            contactId,
            depuis: args.depuis,
            jusquAu: args.jusquAu,
            limite: args.limite ?? 10,
          });
          const titre =
            args.filtre === "urgentes"
              ? "Affaires urgentes"
              : args.filtre === "en_attente"
                ? "Affaires en attente"
                : args.statut === "validees"
                  ? "Affaires validées"
                  : args.statut === "fermees"
                    ? "Affaires fermées"
                    : args.statut === "toutes"
                      ? "Affaires"
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
        "Les tâches du dirigeant et ses rendez-vous. `periode` : aujourd_hui, demain, semaine (d'aujourd'hui à dimanche), en_retard, sans_date (les tâches sans échéance), affaire (toutes celles d'une affaire). Pour « lundi », « la semaine prochaine », « en novembre » : des jours explicites `depuis` / `jusquAu` (AAAA-MM-JJ, calculés depuis la date du jour du contexte), qui l'emportent sur la période. Sans période ni jours : toutes les tâches ouvertes, par échéance, les sans-date en dernier. `statut` faites : ce qui a été coché, les jours portant alors sur le jour où la tâche a été faite (« qu'est-ce que j'ai fait hier »). `type` : call = appeler, reply = répondre, decision, check = vérifier, follow_up = relancer, inform, other. `recherche` : des mots du titre. Une affaire désignée (référence ou titre) limite à ses tâches. Les identifiants rendus servent à modifier, cocher ou supprimer une tâche ensuite.",
      inputSchema: z.object({
        periode: z.enum(PERIODES_TACHES).nullable(),
        depuis: z.string().regex(DATE_NUE).nullable(),
        jusquAu: z.string().regex(DATE_NUE).nullable(),
        statut: z.enum(["ouvertes", "faites"]).nullable(),
        type: z.enum(TYPES_TACHE).nullable(),
        recherche: z.string().nullable(),
        ...designation,
        limite: z.number().int().min(1).max(30).nullable(),
      }),
      execute: async ({
        periode,
        depuis,
        jusquAu,
        statut,
        type,
        recherche,
        limite,
        ...args
      }): Promise<SortieOutil> => {
        try {
          let subjectId: string | null = null;
          if (periode === "affaire" || args.reference || args.titre) {
            const cible = await affaire(args);
            if ("message" in cible) return introuvable(cible.message);
            subjectId = cible.id;
          }
          const bornes = bornesPeriode(periode, ctx.now, { depuis, jusquAu });
          const rows = await searchTasks(
            db,
            {
              recherche,
              ...bornes,
              type,
              statut,
              subjectId,
              limite: limite ?? 20,
            },
            ctx.now,
          );
          return {
            type: "taches",
            titre: titreTaches(periode, statut),
            taches: (await enrichTasks(db, rows, ctx.now)).map(toTaskItemData),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    get_kpis: tool({
      description:
        "Les compteurs du jour : affaires ouvertes, urgentes, tâches du jour, en retard, conversations à trier, messages reçus aujourd'hui et sur sept jours. Pour une question chiffrée.",
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
              {
                libelle: "Messages reçus aujourd'hui",
                valeur: b.messagesRecusAujourdhui,
              },
              {
                libelle: "Messages reçus sur sept jours",
                valeur: b.messagesRecus7j,
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
        "Cherche dans l'annuaire : par nom, entreprise, adresse ou numéro. Sans recherche, les contacts récents.",
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
                    { phone: { contains: q, mode: "insensitive" } },
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
        "La fiche d'un contact et ses affaires ouvertes : par son nom (prénom, nom, ou les deux), son adresse ou son entreprise — au moins l'un des trois. Si plusieurs contacts correspondent, l'outil les rend tous : demander lequel, ne pas choisir.",
      inputSchema: z.object({
        nom: z.string().nullable(),
        email: z.string().nullable(),
        entreprise: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const r = await contactUnique(args);
          if (!r.contact) {
            if (r.candidats.length === 0) return introuvable(r.message);
            return {
              type: "contacts",
              contacts: r.candidats.map(contactLigne),
              precision: r.message,
            };
          }
          const c = r.contact;
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
        "Les messages reçus et envoyés, les plus récents d'abord. Sans aucun critère : les derniers messages. `recherche` : des mots de l'objet, du texte ou de l'expéditeur — jamais une date ni « email ». `depuis` / `jusquAu` : des jours AAAA-MM-JJ en heure française, pour « aujourd'hui », « hier », « cette semaine » (la date du jour est dans le contexte). `expediteur` : un nom ou une adresse. `sens` : entrant ou sortant. `canal` : email ou whatsapp. `non_lus` : seulement les messages reçus non lus. Une affaire désignée (référence ou titre) limite à ses messages. Les horodatages rendus sont à l'heure française.",
      inputSchema: z.object({
        recherche: z.string().nullable(),
        depuis: z.string().regex(DATE_NUE).nullable(),
        jusquAu: z.string().regex(DATE_NUE).nullable(),
        expediteur: z.string().nullable(),
        sens: z.enum(["entrant", "sortant"]).nullable(),
        canal: z.enum(["email", "whatsapp"]).nullable(),
        non_lus: z.boolean().nullable(),
        affaire_reference: designation.reference,
        affaire_titre: designation.titre,
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({
        recherche,
        depuis,
        jusquAu,
        expediteur,
        sens,
        canal,
        non_lus: nonLus,
        affaire_reference: reference,
        affaire_titre: titre,
        limite,
      }): Promise<SortieOutil> => {
        try {
          let subjectId: string | null = null;
          if (reference || titre) {
            const cible = await resolveSubject(db, { reference, titre });
            if (!cible) {
              return introuvable(
                "Aucune affaire ne correspond : demander laquelle.",
              );
            }
            subjectId = cible.id;
          }
          return {
            type: "messages",
            messages: await searchMessages(db, {
              recherche,
              depuis: depuis ? instantDebutJourParis(depuis) : null,
              jusquA: jusquAu ? instantFinJourParis(jusquAu) : null,
              expediteur,
              sens,
              canal,
              subjectId,
              nonLus,
              limite: limite ?? 10,
            }),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    list_conversations: tool({
      description:
        "Les conversations du dirigeant, la plus récente d'abord. `filtre` : a_trier (défaut — aucune affaire ne couvre leur dernier message : c'est ce que « à trier » veut dire), suivies (couvertes par une affaire), ignorees. `canal` : email ou whatsapp. Pour « qu'est-ce qui est à trier », « mes conversations WhatsApp ». Pour chercher dans le contenu : search_messages.",
      inputSchema: z.object({
        filtre: z.enum(["a_trier", "suivies", "ignorees"]).nullable(),
        canal: z.enum(["email", "whatsapp"]).nullable(),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({ filtre, canal, limite }): Promise<SortieOutil> => {
        try {
          const filter =
            filtre === "suivies"
              ? "followed"
              : filtre === "ignorees"
                ? "ignored"
                : "unsorted";
          const page = await listConversationItems(db, {
            filter,
            ...(canal ? { channelType: canal } : {}),
            limit: limite ?? 10,
          });
          return {
            type: "conversations",
            titre:
              filtre === "suivies"
                ? "Conversations suivies"
                : filtre === "ignorees"
                  ? "Conversations ignorées"
                  : "Conversations à trier",
            conversations: page.items.map((c) => ({
              id: c.id,
              titre: c.title,
              canal: c.channelType,
              interlocuteur: c.interlocutorName ?? c.interlocutorRaw,
              dernierMessageLe: c.lastMessageAt
                ? horodatageParis(c.lastMessageAt)
                : null,
              apercu: c.preview,
              nonLus: c.unreadCount,
              affaires: c.listeningSubjects.map((s) => s.title),
            })),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    search_knowledge: tool({
      description:
        "Cherche dans la Mémoire de Relvo : les instructions du dirigeant (ses règles) et les documents qu'il a déposés. `recherche` : des mots. `domaine` : le chemin ou le nom d'un dossier du compte. `genre` : instructions ou documents. Sans critère : toute la Mémoire, la plus récente d'abord. Pour « qu'est-ce que je t'ai dit sur… », « quelles sont mes règles », « le document sur… ». Une instruction désactivée est rendue avec `active: false` : elle existe mais ne s'applique pas.",
      inputSchema: z.object({
        recherche: z.string().nullable(),
        domaine: z.string().nullable(),
        genre: z.enum(["instructions", "documents"]).nullable(),
        limite: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({
        recherche,
        domaine: nomDomaine,
        genre,
        limite,
      }): Promise<SortieOutil> => {
        try {
          let f: FolderNode | null = null;
          if (nomDomaine) {
            const r = await dossierDit(nomDomaine);
            if (!("dossier" in r)) return introuvable(r.message);
            f = r.dossier;
          }
          return {
            type: "memoire",
            connaissances: await searchKnowledge(db, {
              recherche,
              folderId: f?.id ?? null,
              genre,
              limite: limite ?? 10,
            }),
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    get_mail_reading: tool({
      description:
        "Où en est la lecture du courrier récent d'une boîte e-mail (celle que Relvo fait dès qu'une boîte est reliée) : en attente, en cours, terminée, arrêtée au garde-fou ; messages lus, fils lus sur le total, affaires ouvertes, messages mis de côté. `boite` : le nom ou l'adresse d'une boîte, si le dirigeant la nomme ; sans critère, la dernière lecture de chaque boîte. Pour « où en es-tu de la lecture », « tu as fini de lire mes mails ? », « combien d'affaires tu as ouvertes en lisant ».",
      inputSchema: z.object({
        boite: z.string().nullable(),
      }),
      execute: async ({ boite }): Promise<SortieOutil> => {
        try {
          const canaux = await db.channel.findMany({
            where: {
              type: "email",
              ...(boite?.trim()
                ? {
                    OR: [
                      { name: { contains: boite.trim(), mode: "insensitive" } },
                      {
                        identifier: {
                          contains: boite.trim(),
                          mode: "insensitive",
                        },
                      },
                    ],
                  }
                : {}),
            },
            orderBy: { createdAt: "asc" },
            include: {
              catchups: { orderBy: { requestedAt: "desc" }, take: 1 },
            },
          });
          if (boite?.trim() && canaux.length === 0) {
            return introuvable(`Aucune boîte « ${boite.trim()} ».`);
          }
          const lectures: LectureLigne[] = canaux
            .filter((c) => c.catchups[0])
            .map((c) => {
              const r = c.catchups[0]!;
              return {
                boite: c.name,
                status: r.status,
                messagesImported: r.messagesImported,
                messagesTriaged: r.messagesTriaged,
                subjectsOpened: r.subjectsOpened,
                conversationsIgnored: r.conversationsIgnored,
                candidatesTotal: r.candidatesTotal,
                importDone: r.importDone,
                stopReason: r.stopReason,
                demandeeLe: horodatageParis(r.requestedAt),
              };
            });
          if (lectures.length === 0) {
            return introuvable(
              "Aucune lecture du courrier : aucune boîte e-mail reliée, ou pas encore lue.",
            );
          }
          return { type: "lecture", lectures };
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

    // ── Dossiers (M23.7) — par les mêmes fonctions que la Mémoire ─────────
    list_folders: tool({
      description:
        "Liste les dossiers du dirigeant, en arbre, avec leur chemin (« Clients › Franchises ») et le nombre d'affaires ouvertes qu'ils contiennent. Pour « quels dossiers j'ai ? », « où est rangé… ». Inutile avant de créer, déplacer ou ranger : ces outils disent eux-mêmes quand un dossier manque ou qu'un nom en désigne plusieurs.",
      inputSchema: z.object({}),
      execute: async (): Promise<SortieOutil> => {
        try {
          return { type: "dossiers", dossiers: await lignesDossiers() };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    create_folder: tool({
      description:
        "Crée un dossier à la demande EXPLICITE du dirigeant (« crée un dossier Franchises dans Clients ») — jamais de ta propre initiative. `dans` : le chemin ou le nom du dossier père, ou null pour un dossier de premier niveau. Trois niveaux au plus.",
      inputSchema: z.object({
        nom: z.string(),
        dans: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          let parentId: string | null = null;
          if (args.dans) {
            const r = await dossierDit(args.dans);
            if (!("dossier" in r)) return introuvable(r.message);
            parentId = r.dossier.id;
          }
          const f = await createFolder(db, { name: args.nom.trim(), parentId });
          ecrit();
          const tree = await loadFolderTree(db);
          return {
            type: "dossier",
            geste: "créé",
            nom: f.name,
            chemin: cheminDe(tree, f.id),
            folderId: f.id,
            annulation: { type: "dossier", id: f.id, a: a() },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    move_folder: tool({
      description:
        "Range un dossier dans un autre, avec tout ce qu'il contient (« mets Narbonne dans Franchises »). `dossier` : le chemin ou le nom du dossier à déplacer. `dans` : le chemin ou le nom du père, ou null pour le remonter au premier niveau.",
      inputSchema: z.object({
        dossier: z.string(),
        dans: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const cible = await dossierDit(args.dossier);
          if (!("dossier" in cible)) return introuvable(cible.message);
          let parentId: string | null = null;
          if (args.dans) {
            const r = await dossierDit(args.dans);
            if (!("dossier" in r)) return introuvable(r.message);
            parentId = r.dossier.id;
          }
          const precedent = cible.dossier.parentId;
          const f = await moveFolder(db, cible.dossier.id, parentId, CHAT);
          ecrit();
          const tree = await loadFolderTree(db);
          return {
            type: "dossier",
            geste: "déplacé",
            nom: f.name,
            chemin: cheminDe(tree, f.id),
            folderId: f.id,
            annulation: {
              type: "dossier-deplace",
              id: f.id,
              precedent,
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    move_subject: tool({
      description:
        "Range une affaire dans un dossier (« mets l'affaire Narbonne dans Franchises », « classe ça dans Fournisseurs »). `domaine` : le chemin ou le nom du dossier, ou null pour la sortir de tout dossier.",
      inputSchema: z.object({
        ...designation,
        domaine: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const cible = await affaire(args);
          if (!("id" in cible)) return introuvable(cible.message);
          let folderId: string | null = null;
          if (args.domaine) {
            const r = await dossierDit(args.domaine);
            if (!("dossier" in r)) return introuvable(r.message);
            folderId = r.dossier.id;
          }
          const avant = await db.subject.findFirst({
            where: { id: cible.id },
            select: { folderId: true },
          });
          const s = await updateSubject(db, cible.id, { folderId }, CHAT);
          ecrit();
          const tree = await loadFolderTree(db);
          return {
            type: "affaire-modifiee",
            geste: folderId
              ? `rangée dans ${cheminDe(tree, folderId)}`
              : "sortie de son dossier",
            affaire: (await lignesAffaires([s.id]))[0]!,
            annulation: {
              type: "affaire-rangee",
              id: s.id,
              precedent: avant?.folderId ?? null,
              a: a(),
            },
          };
        } catch (e) {
          return erreur(e);
        }
      },
    }),

    // ── Affaires ─────────────────────────────────────────────────────────
    create_subject: tool({
      description:
        "Ouvre une affaire à la demande du dirigeant : un titre court orienté métier, un dossier du compte s'il convient, un contact connu s'il est nommé, un résumé d'une phrase.",
      inputSchema: z.object({
        titre: z.string(),
        domaine: z
          .string()
          .nullable()
          .describe("Le chemin ou le nom d'un dossier du compte, ou null."),
        contact: z
          .string()
          .nullable()
          .describe("Le nom d'un contact de l'annuaire, ou null."),
        resume: z.string().nullable(),
      }),
      execute: async (args): Promise<SortieOutil> => {
        try {
          const f = args.domaine ? await domaine(args.domaine) : null;
          let c: Contact | null = null;
          if (args.contact) {
            const r = await contactUnique({ nom: args.contact });
            if (!r.contact && r.candidats.length > 0) {
              return introuvable(r.message);
            }
            c = r.contact;
          }
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
          const r = await ctx.brouillon(t.id);
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
        "Écrit une instruction dans la Mémoire de Relvo, à la demande du dirigeant : une règle qu'il veut que tu appliques (« les devis au-dessus de 5 000 € passent par moi »). Dans un dossier du compte (son chemin ou son nom), sinon dans « Général » — une instruction donnée à un dossier vaut pour tout ce qu'il contient.",
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
              message: "Aucun dossier pour accueillir l'instruction.",
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
export type RelvoUIMessage = UIMessage<MetaRelvo, UIDataTypes, OutilsRelvoUI>;
