import type { Prisma } from "../generated/prisma/client";
import { Actor } from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb } from "../tenant";
import { EVENT_TYPES } from "./events";

// LA DÉDUPLICATION (M25.8) — un même fichier n'est stocké qu'UNE fois par
// compte. WhatsApp transfère beaucoup, et un fil d'e-mail rejoint les mêmes
// pièces à chaque réponse : sans elle, un fichier sur quatre est un doublon.
//
// Le principe : deux pièces d'un même compte qui ont la même EMPREINTE et le
// même poids partagent une clé d'objet. La ligne reste — chaque message garde
// sa pièce, avec son nom —, seul le fichier est commun. Rien d'autre ne
// change : la pièce s'ouvre par sa clé, et la file de suppression épargne une
// clé qu'une autre ligne référence encore (`./file-deletions`,
// `encoreReferencees`) — le fichier part quand sa DERNIÈRE pièce part.
//
// L'empreinte est le MD5 du contenu, en hexadécimal : celle que le stockage
// calcule lui-même pour chaque objet et rend dans son listing. C'est ce qui
// permet de vérifier la base contre le bucket sans relire un octet — le
// backoffice compte ainsi les doublons qui resteraient (`/admin/stockage`).
//
//   · À L'ENTRÉE : `trouverCleDeMemeContenu` — l'application, avant de poser
//     un fichier, demande si le compte l'a déjà. C'est elle qui fait le
//     travail : toute pièce stockée porte son empreinte.
//   · LE FILET : `dedoublonnerLeCompte`, que le cron du matin passe sur chaque
//     compte. Deux exemplaires arrivés au même instant ont pu se croiser à
//     l'entrée — chacun a cherché avant que l'autre soit noté ; le filet les
//     rapproche d'après les empreintes en base, sans rien lire au stockage.
//
// Jamais d'un compte à l'autre : une clé porte son compte, et un fichier
// partagé entre deux comptes lierait leur sort.

/** Un MD5 en hexadécimal — pas l'empreinte composite d'un envoi en plusieurs parts. */
const EMPREINTE = /^[0-9a-f]{32}$/;

export function estUneEmpreinte(v: string | null | undefined): v is string {
  return !!v && EMPREINTE.test(v);
}

/**
 * La clé d'un fichier que le compte stocke déjà sous cette empreinte et ce
 * poids, ou `null`. La plus ancienne : toutes les pièces d'un même contenu
 * convergent vers elle.
 */
export async function trouverCleDeMemeContenu(
  db: TenantDb,
  contenu: { contentHash: string; fileSize: number },
): Promise<string | null> {
  if (!estUneEmpreinte(contenu.contentHash)) return null;
  const piece = await db.attachment.findFirst({
    where: {
      contentHash: contenu.contentHash,
      fileSize: contenu.fileSize,
      storageKey: { not: null },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { storageKey: true },
  });
  return piece?.storageKey ?? null;
}

/** Une pièce stockée, telle que le plan la lit. */
export type PieceStockee = {
  storageKey: string;
  contentHash: string | null;
  fileSize: number | null;
  createdAt: Date;
};

export type PlanDeDeduplication = {
  /** Pour chaque contenu en plusieurs exemplaires : la clé gardée, celles qui partent. */
  groupes: { garde: string; abandonnees: string[]; octets: number }[];
  /** Pièces qui changeront de clé, fichiers qui partiront, et leur poids. */
  piecesRepointees: number;
  fichiersLiberes: number;
  octetsLiberes: number;
};

/**
 * Le PLAN d'un compte — pur : ce que le filet rapprocherait, d'après ses
 * pièces stockées. Une clé n'entre dans un groupe que si TOUTES ses pièces
 * disent la même empreinte et le même poids : dans le doute, un fichier reste
 * où il est. Pour chaque contenu, la clé gardée est celle de la pièce la plus
 * ancienne — la même que `trouverCleDeMemeContenu` rend à l'entrée.
 */
export function planDeDeduplication(
  pieces: readonly PieceStockee[],
): PlanDeDeduplication {
  type Cle = {
    key: string;
    contenu: string | null;
    size: number;
    depuis: number;
    n: number;
  };
  const cles = new Map<string, Cle>();
  for (const p of pieces) {
    const contenu =
      estUneEmpreinte(p.contentHash) && p.fileSize != null
        ? `${p.contentHash}|${p.fileSize}`
        : null;
    const t = p.createdAt.getTime();
    const c = cles.get(p.storageKey);
    if (c) {
      c.n += 1;
      c.depuis = Math.min(c.depuis, t);
      if (c.contenu !== contenu) c.contenu = null;
    } else {
      cles.set(p.storageKey, {
        key: p.storageKey,
        contenu,
        size: p.fileSize ?? 0,
        depuis: t,
        n: 1,
      });
    }
  }
  const parContenu = new Map<string, Cle[]>();
  for (const c of cles.values()) {
    if (!c.contenu) continue;
    (
      parContenu.get(c.contenu) ?? parContenu.set(c.contenu, []).get(c.contenu)!
    ).push(c);
  }
  const plan: PlanDeDeduplication = {
    groupes: [],
    piecesRepointees: 0,
    fichiersLiberes: 0,
    octetsLiberes: 0,
  };
  for (const exemplaires of parContenu.values()) {
    if (exemplaires.length < 2) continue;
    exemplaires.sort(
      (a, b) => a.depuis - b.depuis || a.key.localeCompare(b.key),
    );
    const [garde, ...autres] = exemplaires;
    plan.groupes.push({
      garde: garde!.key,
      abandonnees: autres.map((c) => c.key),
      octets: autres.length * garde!.size,
    });
    plan.piecesRepointees += autres.reduce((s, c) => s + c.n, 0);
    plan.fichiersLiberes += autres.length;
    plan.octetsLiberes += autres.length * garde!.size;
  }
  return plan;
}

export type BilanDeDeduplication = {
  /** Pièces qui pointent maintenant vers le fichier d'une autre. */
  piecesRepointees: number;
  /** Fichiers mis en file de suppression, et leur poids. */
  fichiersLiberes: number;
  octetsLiberes: number;
};

/**
 * Le filet sur UN compte. Dans une seule transaction : les doublons pointent
 * sur le fichier gardé, et les fichiers abandonnés entrent en file de
 * suppression — un arrêt en chemin ne laisse ni pièce sans fichier, ni fichier
 * sans propriétaire. Se rejoue sans effet.
 *
 * Cross-tenant par construction, comme le nettoyage (`./nettoyage`) : appelée
 * seulement par le cron du matin.
 */
export async function dedoublonnerLeCompte(
  accountId: string,
): Promise<BilanDeDeduplication> {
  const pieces = await prisma.attachment.findMany({
    where: {
      accountId,
      storageKey: { not: null },
      contentHash: { not: null },
    },
    select: {
      storageKey: true,
      contentHash: true,
      fileSize: true,
      createdAt: true,
    },
  });
  const plan = planDeDeduplication(
    pieces.map((p) => ({ ...p, storageKey: p.storageKey! })),
  );
  const bilan: BilanDeDeduplication = {
    piecesRepointees: plan.piecesRepointees,
    fichiersLiberes: plan.fichiersLiberes,
    octetsLiberes: plan.octetsLiberes,
  };
  if (plan.groupes.length === 0) return bilan;

  const abandonnees = plan.groupes.flatMap((g) => g.abandonnees);
  const gardes = plan.groupes.flatMap((g) => g.abandonnees.map(() => g.garde));
  await prisma.$transaction(
    async (tx) => {
      bilan.piecesRepointees = await tx.$executeRaw`
        UPDATE attachments a
        SET storage_key = v.garde
        FROM unnest(${abandonnees}::text[], ${gardes}::text[]) AS v(abandonnee, garde)
        WHERE a.account_id = ${accountId}::uuid
          AND a.storage_key = v.abandonnee
      `;
      // Aucune ligne ne porte plus ces clés : le déclencheur de suppression ne
      // les verra jamais partir. C'est ici qu'elles entrent en file — le
      // drainage vérifie encore, avant d'effacer, que personne ne les tient.
      await tx.$executeRaw`
        INSERT INTO pending_file_deletions (storage_key)
        SELECT unnest(${abandonnees}::text[])
      `;
      // Hors client tenant (le filet est cross-tenant) : le compte est écrit
      // à la main sur l'entrée de journal.
      await tx.eventLog.create({
        data: {
          accountId,
          entityType: "system",
          entityId: accountId,
          eventType: EVENT_TYPES.deduplication,
          title: "Déduplication : un même fichier n'est stocké qu'une fois",
          actor: Actor.system,
          metadata: {
            piecesRepointees: bilan.piecesRepointees,
            fichiersLiberes: bilan.fichiersLiberes,
            octetsLiberes: bilan.octetsLiberes,
          },
        } as Prisma.EventLogUncheckedCreateInput,
      });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
  return bilan;
}
