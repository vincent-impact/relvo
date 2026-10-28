import {
  type AccountRole,
  Actor,
  type CatchupStatus,
  type ChannelConfigStatus,
  type ChannelType,
  type Sector,
} from "../generated/prisma/enums";
import { prisma } from "../index";
import { tenantDb, type TenantDb, type Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { countPendingFileDeletions } from "./file-deletions";
import { listPushSubscriptions } from "./notifications";
import {
  countOpenQuestions,
  listOpenQuestions,
  type OpenQuestion,
} from "./questions";
import { debutDuMoisParis } from "./temps";
import {
  type AiFailureRow,
  type AiSolicitationRow,
  type AiSolicitationSummary,
  listAiFailures,
  listAiSolicitations,
  summarizeAiSolicitations,
} from "./triage";

// L'administration (M21) — ce que le backoffice LIT, et le seul geste qui
// n'a pas de méthode ailleurs : supprimer un compte.
//
// Lecture hors tenant, comme `listPushAccounts` : l'administrateur voit tous
// les comptes. Mais chaque chiffre d'un compte vient de LA fonction que le
// produit utilise déjà pour lui — `countOpenQuestions`, `listPushSubscriptions`,
// `listAiSolicitations` sur son client tenant — jamais d'un compteur parallèle :
// une seconde implémentation divergerait en une semaine. Une lecture par compte
// et par fonction : c'est une page d'exploitation pour une poignée de comptes,
// pas une page produit — on accepte des requêtes en nombre de comptes, jamais
// en nombre de sujets ou de messages.

/** Les deux fenêtres de coût affichées (jours). */
export const ADMIN_COST_WINDOWS = { courte: 7, longue: 30 } as const;

export type AdminChannel = {
  id: string;
  name: string;
  type: ChannelType;
  identifier: string;
  /** Le fournisseur derrière le canal (M24.1) ; null = canal sans configuration. */
  provider: string | null;
  /** L'état de la connexion chez le fournisseur ; null = canal sans configuration. */
  status: ChannelConfigStatus | null;
  /** L'identifiant du compte chez l'agrégateur — à déconnecter avant toute suppression. */
  externalAccountId: string | null;
};

export type AdminAccountRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AccountRole;
  isTest: boolean;
  assistantEnabled: boolean;
  sectors: Sector[];
  createdAt: Date;
  /** Null = inscrit, en attente qu'un administrateur ouvre l'accès (M21.6). */
  activatedAt: Date | null;
  /** Le dernier geste de l'utilisateur lui-même (journal, acteur `user`) ; null = jamais. */
  lastActivityAt: Date | null;
  channels: AdminChannel[];
  openSubjects: number;
  openQuestions: number;
  pushDevices: number;
  /** Coût d'inférence en euros, somme du journal des sollicitations. */
  coutEurCourt: number;
  coutEurLong: number;
  appelsLong: number;
};

type AccountWithChannels = NonNullable<
  Awaited<ReturnType<typeof findAccountWithChannels>>
>;

function findAccountWithChannels(id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      channels: {
        orderBy: { createdAt: "asc" },
        include: {
          config: {
            select: { provider: true, status: true, externalAccountId: true },
          },
        },
      },
    },
  });
}

/** Le dernier geste de l'utilisateur par compte — une requête pour tous. */
async function lastActivityByAccount(): Promise<Map<string, Date>> {
  const rows = await prisma.eventLog.groupBy({
    by: ["accountId"],
    where: { actor: Actor.user },
    _max: { createdAt: true },
  });
  return new Map(
    rows
      .filter((r) => r._max.createdAt !== null)
      .map((r) => [r.accountId, r._max.createdAt as Date]),
  );
}

async function rowFor(
  account: AccountWithChannels,
  lastActivityAt: Date | null,
  now: Date,
): Promise<AdminAccountRow> {
  const db = tenantDb(account.id);
  const sinceLong = new Date(
    now.getTime() - ADMIN_COST_WINDOWS.longue * 86_400_000,
  );
  const sinceCourt = new Date(
    now.getTime() - ADMIN_COST_WINDOWS.courte * 86_400_000,
  );
  const [openSubjects, openQuestions, appareils, sollicitations] =
    await Promise.all([
      db.subject.count({ where: { status: "open" } }),
      countOpenQuestions(db),
      listPushSubscriptions(db),
      listAiSolicitations(db, { since: sinceLong }),
    ]);
  const somme = (depuis: Date) =>
    sollicitations
      .filter((s) => s.at >= depuis)
      .reduce((acc, s) => acc + s.coutEur, 0);
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    isTest: account.isTest,
    assistantEnabled: account.assistantEnabled,
    sectors: account.sectors,
    createdAt: account.createdAt,
    activatedAt: account.activatedAt,
    lastActivityAt,
    channels: account.channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      identifier: c.identifier,
      provider: c.config?.provider ?? null,
      status: c.config?.status ?? null,
      externalAccountId: c.config?.externalAccountId ?? null,
    })),
    openSubjects,
    openQuestions,
    pushDevices: appareils.length,
    coutEurCourt: somme(sinceCourt),
    coutEurLong: somme(sinceLong),
    appelsLong: sollicitations.length,
  };
}

/**
 * Tous les comptes, avec ce que le backoffice en montre (M21.2). Les plus
 * récents d'abord ; l'écran regroupe ensuite (en attente, actifs, tests).
 */
export async function listAccountsForAdmin(
  opts: { now?: Date } = {},
): Promise<AdminAccountRow[]> {
  const now = opts.now ?? new Date();
  const [accounts, activity] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        channels: {
          orderBy: { createdAt: "asc" },
          include: {
            config: {
              select: { provider: true, status: true, externalAccountId: true },
            },
          },
        },
      },
    }),
    lastActivityByAccount(),
  ]);
  const rows: AdminAccountRow[] = [];
  for (const account of accounts) {
    rows.push(await rowFor(account, activity.get(account.id) ?? null, now));
  }
  return rows;
}

/** Un compte, tel que le backoffice le montre ; null s'il n'existe pas. */
export async function getAccountForAdmin(
  id: string,
  opts: { now?: Date } = {},
): Promise<AdminAccountRow | null> {
  const account = await findAccountWithChannels(id);
  if (!account) return null;
  const activity = await prisma.eventLog.aggregate({
    where: { accountId: id, actor: Actor.user },
    _max: { createdAt: true },
  });
  return rowFor(account, activity._max.createdAt, opts.now ?? new Date());
}

export type DeleteAccountInput = {
  targetId: string;
  /**
   * Ce que l'appelant a fait chez l'agrégateur AVANT d'appeler : l'intégration
   * vit dans l'application, le domaine n'en connaît que le bilan, qu'il
   * consigne — un échec là-bas se finit à la main dans le dashboard.
   */
  unipile: { deconnectes: string[]; echecs: string[] };
};

/**
 * Supprime un compte — DÉFINITIVEMENT, la seule opération irréversible du
 * produit (M21.4). La base cascade (toutes les relations d'`Account` le sont),
 * les triggers enfilent les clés de fichiers dans l'outbox que le cron draine.
 * Pas de corbeille : un compte de test supprimé n'existe plus.
 *
 * Le journal du compte disparaît avec lui : la trace s'écrit donc sur le
 * compte de l'ADMINISTRATEUR (`adminDb`), dans la transaction de la
 * suppression — e-mail, identifiant, canaux et bilan de l'agrégateur en
 * métadonnée. Les refus (soi-même, le compte de démonstration, l'e-mail
 * retapé) sont des règles de l'écran, vérifiées avant d'arriver ici.
 */
export async function deleteAccount(
  adminDb: TenantDb,
  input: DeleteAccountInput,
): Promise<{ email: string; channels: number }> {
  const target = assertFound(
    await prisma.account.findUnique({
      where: { id: input.targetId },
      select: {
        id: true,
        email: true,
        isTest: true,
        createdAt: true,
        channels: { select: { id: true } },
      },
    }),
    "Compte",
  );
  // Le GROS du tenant s'efface D'ABORD, table par table, hors de toute
  // transaction interactive (PITFALLS #71) : une cascade de tout un compte
  // — des milliers de messages, leurs pièces jointes et le déclencheur qui
  // enfile chaque clé de fichier — dépassait le délai de cinq secondes de la
  // transaction Prisma, et le compte restait là, son agrégateur déjà
  // déconnecté. Chaque instruction est bornée à une table du compte,
  // idempotente : une suppression interrompue se reprend en la relançant. La
  // transaction finale ne porte plus que la trace chez l'administrateur et la
  // ligne du compte, dont la cascade n'emporte que les restes.
  const cible = { accountId: target.id };
  await prisma.attachment.deleteMany({ where: cible });
  await prisma.message.deleteMany({ where: cible });
  await prisma.subjectConversation.deleteMany({ where: cible });
  await prisma.conversation.deleteMany({ where: cible });
  await prisma.action.deleteMany({ where: cible });
  await prisma.task.deleteMany({ where: cible });
  await prisma.subject.deleteMany({ where: cible });
  await prisma.knowledgeDocument.deleteMany({ where: cible });
  await prisma.contact.deleteMany({ where: cible });
  await prisma.eventLog.deleteMany({ where: cible });
  await adminDb.$transaction(
    async (tx) => {
      await logEvent(tx as Tx, {
        entityType: "system",
        entityId: target.id,
        eventType: EVENT_TYPES.accountDeleted,
        title: `Compte « ${target.email} » supprimé`,
        actor: Actor.user,
        metadata: {
          accountId: target.id,
          email: target.email,
          isTest: target.isTest,
          creeLe: target.createdAt.toISOString(),
          canaux: target.channels.length,
          unipile: input.unipile,
        },
      });
      await tx.account.delete({ where: { id: target.id } });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return { email: target.email, channels: target.channels.length };
}

// ─────────────────────────────────────────────────────────────
// La fiche d'un compte (M21.3) et la vue d'ensemble (M21.5)
// ─────────────────────────────────────────────────────────────

export type AdminJournalEntry = {
  at: Date;
  eventType: string;
  title: string;
  actor: Actor;
};

export type AdminCatchup = {
  id: string;
  channelName: string;
  status: CatchupStatus;
  requestedAt: Date;
  finishedAt: Date | null;
  messagesImported: number;
  subjectsOpened: number;
  conversationsIgnored: number;
  costEur: number;
  lastError: string | null;
};

export type AdminAccountJournal = {
  /** Le compteur relu, par sollicitation, sur la fenêtre longue. */
  synthese: AiSolicitationSummary[];
  /** Les appels dont le cache aurait dû jouer et n'a pas joué, les plus récents d'abord. */
  silencieux: AiSolicitationRow[];
  /** Appels sans préfixe mesuré (antérieurs à la mesure, ou brouillons). */
  nonMesures: number;
  echecs: AiFailureRow[];
  journal: AdminJournalEntry[];
  rattrapages: AdminCatchup[];
  questions: OpenQuestion[];
};

/**
 * Ce que `ia:journal` imprime, rendu pour une page (M21.3) — par les mêmes
 * fonctions —, plus les échecs, le journal de bord récent, les rattrapages et
 * les questions ouvertes du compte.
 */
export async function getAccountJournal(
  accountId: string,
  opts: { now?: Date; journalLimit?: number } = {},
): Promise<AdminAccountJournal> {
  const now = opts.now ?? new Date();
  const since = new Date(
    now.getTime() - ADMIN_COST_WINDOWS.longue * 86_400_000,
  );
  const db = tenantDb(accountId);
  const [lignes, echecs, journal, rattrapages, questions] = await Promise.all([
    listAiSolicitations(db, { since }),
    listAiFailures(db, { since, limit: 20 }),
    db.eventLog.findMany({
      orderBy: { createdAt: "desc" },
      take: opts.journalLimit ?? 50,
      select: { createdAt: true, eventType: true, title: true, actor: true },
    }),
    db.channelCatchup.findMany({
      orderBy: { requestedAt: "desc" },
      take: 10,
      include: { channel: { select: { name: true } } },
    }),
    listOpenQuestions(db, { limit: 5 }),
  ]);
  const synthese = summarizeAiSolicitations(lignes);
  return {
    synthese,
    silencieux: synthese
      .flatMap((s) => s.silencieux)
      .sort((a, b) => b.at.getTime() - a.at.getTime()),
    nonMesures: lignes.filter((l) => l.prefixeStable === null).length,
    echecs,
    journal: journal.map((e) => ({
      at: e.createdAt,
      eventType: e.eventType,
      title: e.title,
      actor: e.actor,
    })),
    rattrapages: rattrapages.map((r) => ({
      id: r.id,
      channelName: r.channel.name,
      status: r.status,
      requestedAt: r.requestedAt,
      finishedAt: r.finishedAt,
      messagesImported: r.messagesImported,
      subjectsOpened: r.subjectsOpened,
      conversationsIgnored: r.conversationsIgnored,
      costEur: r.costEur,
      lastError: r.lastError,
    })),
    questions,
  };
}

/** Les échecs que la vue d'ensemble compte : ceux du pipeline et ceux de l'échange. */
export const ADMIN_FAILURE_EVENT_TYPES = [
  EVENT_TYPES.triageFailed,
  EVENT_TYPES.structurationFailed,
  EVENT_TYPES.relectureFailed,
  EVENT_TYPES.iaEchec,
] as const;

export type AdminOverview = {
  /** Le 1er du mois en cours, minuit à Paris. */
  moisDepuis: Date;
  coutMoisEur: number;
  appelsMois: number;
  silencieuxMois: number;
  plafondEur: number;
  comptes: number;
  comptesEnAttente: number;
  /** Comptes dont l'utilisateur a agi dans les sept derniers jours. */
  comptesActifs7j: number;
  echecs7j: Record<string, number>;
  outboxEnAttente: number;
  rattrapagesEnEchec: number;
};

/**
 * La vue d'ensemble (M21.5) : ce que les routes logguent déjà, enfin lisible
 * sans `vercel logs`. Chaque chiffre vient du journal ou d'une fonction qui
 * existe — le coût du mois est la somme des sollicitations de tous les
 * comptes, relues compte par compte ; le plafond est celui de la clé du
 * fournisseur, donné par l'appelant (configuration), jamais inventé ici.
 */
export async function getAdminOverview(opts: {
  now?: Date;
  plafondEur: number;
}): Promise<AdminOverview> {
  const now = opts.now ?? new Date();
  const moisDepuis = debutDuMoisParis(now);
  const sept = new Date(now.getTime() - 7 * 86_400_000);

  const [accounts, activity, echecs, outboxEnAttente, rattrapagesEnEchec] =
    await Promise.all([
      prisma.account.findMany({
        select: { id: true, activatedAt: true },
      }),
      lastActivityByAccount(),
      prisma.eventLog.groupBy({
        by: ["eventType"],
        where: {
          eventType: { in: [...ADMIN_FAILURE_EVENT_TYPES] },
          createdAt: { gte: sept },
        },
        _count: { _all: true },
      }),
      countPendingFileDeletions(),
      prisma.channelCatchup.count({ where: { status: "failed" } }),
    ]);

  let coutMoisEur = 0;
  let appelsMois = 0;
  let silencieuxMois = 0;
  for (const a of accounts) {
    const lignes = await listAiSolicitations(tenantDb(a.id), {
      since: moisDepuis,
    });
    appelsMois += lignes.length;
    for (const s of summarizeAiSolicitations(lignes)) {
      coutMoisEur += s.coutEur;
      silencieuxMois += s.silencieux.length;
    }
  }

  const echecs7j: Record<string, number> = {};
  for (const t of ADMIN_FAILURE_EVENT_TYPES) echecs7j[t] = 0;
  for (const e of echecs) echecs7j[e.eventType] = e._count._all;

  return {
    moisDepuis,
    coutMoisEur,
    appelsMois,
    silencieuxMois,
    plafondEur: opts.plafondEur,
    comptes: accounts.length,
    comptesEnAttente: accounts.filter((a) => a.activatedAt === null).length,
    comptesActifs7j: accounts.filter((a) => {
      const at = activity.get(a.id);
      return at !== undefined && at >= sept;
    }).length,
    echecs7j,
    outboxEnAttente,
    rattrapagesEnEchec,
  };
}
