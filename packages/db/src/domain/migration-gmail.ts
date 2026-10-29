import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  ChannelConfigStatus,
  ChannelType,
  QuestionScope,
  QuestionStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound, DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import {
  askQuestion,
  CLE_MIGRER_BOITE,
  ETAPE_MIGRATION_GMAIL,
  canalDeLEtapeDeMigration,
  etapeDeMigration,
} from "./questions";

// LA MIGRATION D'UNE BOÎTE VERS LE RELAIS GMAIL (M24.9). Les boîtes e-mail
// reliées avant le relais passent par l'agrégateur ; leurs jetons sont les
// siens, personne ne peut les transférer. La migration se PROPOSE, elle ne
// bascule pas : Relvo pose une question au dirigeant — relier la boîte à
// nouveau, avec Google —, et tant qu'il n'a pas fait le geste, sa boîte
// continue par l'agrégateur, sans coupure. Au retour du consentement, le canal
// change de fournisseur en gardant son identité — ses conversations, ses
// sujets, son nom — et l'ancien compte s'efface chez l'agrégateur. Jamais de
// relecture des quatorze jours : les identifiants de message du relais ne sont
// pas ceux de l'agrégateur, une relecture ferait entrer chaque message deux
// fois (`estUneBoiteMigree` le dit à qui demande les lectures manquantes).

/** Ce que les données de connexion d'une boîte migrée retiennent de son passé. */
export type MigrationDeBoite = {
  fournisseur: "unipile";
  /** L'identifiant que la boîte avait chez l'agrégateur, pour la trace. */
  compte: string;
  /** ISO : quand la boîte est passée au relais. */
  le: string;
};

/**
 * Une boîte passée au relais depuis l'agrégateur : elle a déjà ses messages,
 * aucune lecture à la connexion ne doit être demandée pour elle.
 */
export function estUneBoiteMigree(connectionData: unknown): boolean {
  const d = connectionData as { migreDe?: unknown } | null | undefined;
  return (
    !!d && typeof d === "object" && !!d.migreDe && typeof d.migreDe === "object"
  );
}

type CanalMigrable = {
  id: string;
  name: string;
  type: ChannelType;
  identifier: string;
  config: {
    provider: string;
    externalAccountId: string | null;
    connectionData: Prisma.JsonValue | null;
  } | null;
};

async function canalMigrable(
  db: TenantDb,
  channelId: string,
): Promise<CanalMigrable & { config: NonNullable<CanalMigrable["config"]> }> {
  const channel = assertFound(
    await db.channel.findFirst({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        type: true,
        identifier: true,
        config: {
          select: {
            provider: true,
            externalAccountId: true,
            connectionData: true,
          },
        },
      },
    }),
    "Canal",
  );
  if (channel.type !== ChannelType.email) {
    throw new DomainError(
      "INVALID_STATE",
      "Seule une boîte e-mail passe au relais Gmail.",
    );
  }
  if (!channel.config?.externalAccountId) {
    throw new DomainError(
      "INVALID_STATE",
      "Cette boîte n'est pas connectée : rien à migrer.",
    );
  }
  if (channel.config.provider !== "unipile") {
    throw new DomainError(
      "INVALID_STATE",
      `La boîte ${channel.identifier} est déjà lue par le relais Gmail.`,
    );
  }
  return channel as CanalMigrable & {
    config: NonNullable<CanalMigrable["config"]>;
  };
}

/**
 * PROPOSE la migration d'une boîte de l'agrégateur : la question de Relvo,
 * dans sa voix, qui ouvre le consentement Google ; « Plus tard » la laisse
 * ouverte, la connexion la ferme (`migrateChannelToGmail`). Une question
 * ouverte pour ce canal n'est pas reposée. L'appelant la pousse (M12.9) : elle
 * naît hors écran, par le script.
 */
export async function proposeGmailMigration(db: TenantDb, channelId: string) {
  const channel = await canalMigrable(db, channelId);
  const step = etapeDeMigration(channel.id);
  const deja = await db.relvoQuestion.findFirst({
    where: { originStep: step, status: QuestionStatus.open },
    select: { id: true },
  });
  const question = await askQuestion(db, {
    scope: QuestionScope.account,
    text: `Je lis désormais votre courrier moi-même, sans intermédiaire. Pour continuer avec ${channel.identifier}, reliez-la à nouveau avec Google : vos conversations et vos sujets restent, rien ne se perd.`,
    proposedAnswers: [
      {
        key: CLE_MIGRER_BOITE,
        label: "Relier avec Google maintenant",
        hint: "Deux écrans chez Google, et c'est fait",
      },
    ],
    originStep: step,
  });
  return { question, deja: deja != null, identifier: channel.identifier };
}

/**
 * Les boîtes dont la migration a été PROPOSÉE — question posée, ouverte,
 * remise à plus tard ou écartée — et qui passent encore par l'agrégateur : la
 * page des canaux leur montre le geste, pour qui n'ouvre pas l'échange.
 */
export async function listPendingGmailMigrations(
  db: TenantDb,
): Promise<string[]> {
  const questions = await db.relvoQuestion.findMany({
    where: { originStep: { startsWith: `${ETAPE_MIGRATION_GMAIL}/` } },
    select: { originStep: true },
  });
  const vises = new Set(
    questions
      .map((q) => canalDeLEtapeDeMigration(q.originStep))
      .filter((id): id is string => id != null),
  );
  if (vises.size === 0) return [];
  const encore = await db.channel.findMany({
    where: {
      id: { in: [...vises] },
      type: ChannelType.email,
      config: { provider: "unipile", externalAccountId: { not: null } },
    },
    select: { id: true },
  });
  return encore.map((c) => c.id);
}

export const migrateChannelToGmailSchema = z.object({
  /** L'adresse de la boîte chez Google, en minuscules : l'identifiant externe du relais. */
  externalAccountId: z.string().trim().min(1).max(255),
  /** Les données de connexion du relais (jetons chiffrés, périmètres), remplacées entières. */
  connectionData: z.record(z.string(), z.unknown()),
});
export type MigrateChannelToGmailInput = z.input<
  typeof migrateChannelToGmailSchema
>;

/**
 * BASCULE un canal de l'agrégateur au relais Gmail, au retour du consentement
 * Google. Le canal garde son identité — le même canal, les mêmes
 * conversations — ; seule sa configuration change : le fournisseur, le compte
 * externe (l'adresse), les données de connexion, et la trace de la migration
 * (`migreDe`). La boîte doit être la même : une autre adresse que celle du
 * canal est refusée, une adresse déjà reliée ailleurs aussi. La question de
 * migration encore ouverte se ferme, répondue par la connexion elle-même.
 * Rend l'ancien compte chez l'agrégateur, que l'appelant efface chez lui.
 */
export async function migrateChannelToGmail(
  db: TenantDb,
  channelId: string,
  input: MigrateChannelToGmailInput,
) {
  const data = migrateChannelToGmailSchema.parse(input);
  const channel = await canalMigrable(db, channelId);
  const adresse = data.externalAccountId.toLowerCase();
  if (channel.identifier.trim().toLowerCase() !== adresse) {
    throw new DomainError(
      "CONFLICT",
      `Ce canal est relié à ${channel.identifier} : reconnectez la même boîte, ou reliez l'autre à part.`,
    );
  }
  const autre = await db.channelConfig.findFirst({
    where: { externalAccountId: adresse, NOT: { channelId } },
    select: { channelId: true },
  });
  if (autre) {
    throw new DomainError(
      "CONFLICT",
      `La boîte ${adresse} est déjà reliée à ce compte.`,
    );
  }
  const ancienCompte = channel.config.externalAccountId!;
  const now = new Date();
  const migreDe: MigrationDeBoite = {
    fournisseur: "unipile",
    compte: ancienCompte,
    le: now.toISOString(),
  };
  try {
    return await db.$transaction(async (tx) => {
      const { count } = await tx.channelConfig.updateMany({
        where: { channelId },
        data: {
          provider: "gmail",
          externalAccountId: adresse,
          status: ChannelConfigStatus.connected,
          lastSyncAt: now,
          connectionData: {
            ...data.connectionData,
            migreDe,
          } as Prisma.InputJsonValue,
        },
      });
      ensureAffected(count, "Configuration de canal");
      await tx.channel.updateMany({
        where: { id: channelId },
        data: { identifier: adresse, name: adresse },
      });
      await logEvent(tx as Tx, {
        entityType: "system",
        entityId: channelId,
        eventType: EVENT_TYPES.channelConfigUpdated,
        title: `Boîte ${adresse} passée au relais Gmail`,
        actor: Actor.user,
        metadata: {
          status: ChannelConfigStatus.connected,
          migration: { de: "unipile", vers: "gmail", compte: ancienCompte },
        },
      });
      // La connexion vaut réponse à la question de migration, jamais le clic.
      const q = await tx.relvoQuestion.findFirst({
        where: {
          originStep: etapeDeMigration(channelId),
          status: QuestionStatus.open,
        },
        select: { id: true, text: true },
      });
      if (q) {
        const answer = `Boîte reliée avec Google : ${adresse}`;
        await tx.relvoQuestion.update({
          where: { id: q.id },
          data: {
            status: QuestionStatus.answered,
            answer,
            answeredAt: now,
          },
        });
        await logEvent(tx as Tx, {
          entityType: "system",
          entityId: q.id,
          eventType: EVENT_TYPES.questionAnswered,
          title: `Réponse à Relvo : ${q.text}`,
          description: answer,
          actor: Actor.system,
          metadata: {
            outcome: "mailbox-migrated",
            originStep: etapeDeMigration(channelId),
          },
        });
      }
      return { channelId, adresse, ancienCompte };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new DomainError(
        "CONFLICT",
        `La boîte ${adresse} est déjà reliée à Relvo.`,
      );
    }
    throw err;
  }
}
