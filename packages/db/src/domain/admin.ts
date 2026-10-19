import {
  type AccountRole,
  Actor,
  type ChannelConfigStatus,
  type ChannelType,
  type Sector,
} from "../generated/prisma/enums";
import { prisma } from "../index";
import { tenantDb, type TenantDb, type Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { listPushSubscriptions } from "./notifications";
import { countOpenQuestions } from "./questions";
import { listAiSolicitations } from "./triage";

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
// en nombre d'affaires ou de messages.

/** Les deux fenêtres de coût affichées (jours). */
export const ADMIN_COST_WINDOWS = { courte: 7, longue: 30 } as const;

export type AdminChannel = {
  id: string;
  name: string;
  type: ChannelType;
  identifier: string;
  /** L'état de la connexion chez l'agrégateur ; null = canal sans configuration. */
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
          config: { select: { status: true, externalAccountId: true } },
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
            config: { select: { status: true, externalAccountId: true } },
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
  await adminDb.$transaction(async (tx) => {
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
  });
  return { email: target.email, channels: target.channels.length };
}
