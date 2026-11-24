import {
  Actor,
  ConversationStatus,
  type IgnoreReason,
  QuestionScope,
} from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb } from "../tenant";
import { EVENT_TYPES } from "./events";
import {
  CLE_VOIR_IGNOREES,
  ETAPE_RELEVE_IGNOREES,
  askQuestion,
} from "./questions";
import { jourParis } from "./temps";

// LE RELEVÉ DE CE QUE RELVO A IGNORÉ (M25.11) — le filet d'un faux verdict.
//
// Ignorer, c'est ne plus importer : une conversation que Relvo écarte à tort
// cesse de recevoir ses messages, et rien ne le rattrape tout seul. Une fois
// par semaine, Relvo dit donc ce qu'il a mis de côté, par raison, dans un
// échange à lui (05 §11.12) ; la réponse « voir la liste » mène aux
// conversations ignorées, où chacune se reprend d'un geste.
//
// Le relevé COMPTE ce qui est encore ignoré par Relvo : une conversation que
// le dirigeant a déjà reprise n'y figure plus. Il ne se pose pas quand il n'y
// a rien à dire.

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Ce que le relevé regarde, et l'écart minimal entre deux relevés. */
export const RELEVE_FENETRE_JOURS = 7;

export type ReleveIgnorees = {
  total: number;
  /** Par raison, la plus fréquente d'abord. */
  parRaison: { reason: IgnoreReason | null; count: number }[];
};

/** Les conversations que Relvo a ignorées depuis une date, et qui le sont encore. */
export async function releveDesIgnorees(
  db: TenantDb,
  depuis: Date,
): Promise<ReleveIgnorees> {
  const gestes = await db.eventLog.findMany({
    where: {
      eventType: EVENT_TYPES.conversationIgnored,
      actor: Actor.ai,
      createdAt: { gte: depuis },
    },
    select: { entityId: true },
  });
  const ids = [
    ...new Set(
      gestes.map((g) => g.entityId).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return { total: 0, parRaison: [] };
  const encore = await db.conversation.findMany({
    where: {
      id: { in: ids },
      status: ConversationStatus.ignored,
      ignoredByActor: Actor.ai,
    },
    select: { ignoreReason: true },
  });
  const comptes = new Map<IgnoreReason | null, number>();
  for (const c of encore) {
    comptes.set(c.ignoreReason, (comptes.get(c.ignoreReason) ?? 0) + 1);
  }
  const parRaison = [...comptes]
    .map(([reason, count]) => ({ reason, count }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.reason ?? "").localeCompare(b.reason ?? ""),
    );
  return {
    total: parRaison.reduce((n, r) => n + r.count, 0),
    parRaison,
  };
}

const MOTS: Record<IgnoreReason, [un: string, plusieurs: string]> = {
  advertising: ["publicité", "publicités"],
  prospecting: ["démarchage", "démarchages"],
  automatic: ["notification automatique", "notifications automatiques"],
  personal: ["conversation personnelle", "conversations personnelles"],
  not_my_role: ["hors de votre rôle", "hors de votre rôle"],
  handled_elsewhere: ["traitée ailleurs", "traitées ailleurs"],
  other: ["autre", "autres"],
};

/** La phrase du relevé — pure, dans les mots du dirigeant. */
export function phraseDuReleve(releve: ReleveIgnorees): string {
  const quoi =
    releve.total > 1 ? `${releve.total} conversations` : "1 conversation";
  const detail = releve.parRaison
    .map(({ reason, count }) => {
      const [un, plusieurs] = MOTS[reason ?? "other"];
      return `${count} ${count > 1 ? plusieurs : un}`;
    })
    .join(", ");
  const suite =
    releve.total > 1
      ? "Je n'importe plus leurs messages."
      : "Je n'importe plus ses messages.";
  return `Cette semaine, j'ai mis de côté ${quoi} : ${detail}. ${suite} Est-ce que c'est juste ?`;
}

/**
 * Pose le relevé de la semaine, s'il y a quelque chose à dire et qu'aucun n'a
 * été posé dans la fenêtre — répondu ou non. Rend la question, ou null.
 */
export async function poserReleveIgnorees(
  db: TenantDb,
  now: Date = new Date(),
) {
  const depuis = new Date(now.getTime() - RELEVE_FENETRE_JOURS * JOUR_MS);
  const deja = await db.relvoQuestion.findFirst({
    where: {
      originStep: { startsWith: `${ETAPE_RELEVE_IGNOREES}/` },
      // Un jour de marge : le cron ne passe pas à la seconde près.
      askedAt: { gt: new Date(depuis.getTime() + JOUR_MS) },
    },
    select: { id: true },
  });
  if (deja) return null;
  const releve = await releveDesIgnorees(db, depuis);
  if (releve.total === 0) return null;
  return askQuestion(db, {
    scope: QuestionScope.account,
    text: phraseDuReleve(releve),
    proposedAnswers: [
      { key: "ok", label: "C'est bien ça" },
      {
        key: CLE_VOIR_IGNOREES,
        label: "Voir la liste",
        hint: "Pour en reprendre une d'un geste",
      },
    ],
    originStep: `${ETAPE_RELEVE_IGNOREES}/${jourParis(now)}`,
  });
}

/**
 * Les comptes dont l'assistant est actif — cross-tenant, pour le cron du matin,
 * comme `listPushAccounts` : le cron ouvre ensuite un client tenant par compte.
 */
export async function listAssistantAccounts(): Promise<string[]> {
  const rows = await prisma.account.findMany({
    where: { assistantEnabled: true, isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => r.id);
}
