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
// permet de dédoublonner le STOCK sans retélécharger un octet, et de vérifier
// la base contre le bucket.
//
//   · À L'ENTRÉE : `trouverCleDeMemeContenu` — l'application, avant de poser
//     un fichier, demande si le compte l'a déjà.
//   · SUR LE STOCK : `dedoublonnerLeCompte` — d'après le listing du bucket,
//     note l'empreinte des pièces qui n'en ont pas, puis fait pointer les
//     doublons sur un seul fichier et met les autres en file de suppression.
//     Sait d'abord se simuler, par le même calcul (`planDeDeduplication`).
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

/** Ce que le stockage dit d'un objet : son empreinte et son poids. */
export type ObjetStocke = { etag: string | null; size: number };

/** Une pièce stockée, telle que le plan la lit. */
export type PieceStockee = {
  storageKey: string;
  contentHash: string | null;
  createdAt: Date;
};

export type PlanDeDeduplication = {
  /** Clés dont les pièces n'ont pas encore leur empreinte en base. */
  aNoter: { storageKey: string; contentHash: string }[];
  /** Pour chaque contenu en plusieurs exemplaires : la clé gardée, celles qui partent. */
  groupes: { garde: string; abandonnees: string[]; octets: number }[];
  /** Pièces qui changeront de clé, fichiers qui partiront, et leur poids. */
  piecesRepointees: number;
  fichiersLiberes: number;
  octetsLiberes: number;
};

/**
 * Le PLAN d'un compte — pur : ce que la déduplication noterait et
 * rapprocherait, d'après ses pièces stockées et ce que le bucket porte. Une
 * clé absente du bucket, ou sans empreinte simple, n'entre dans aucun groupe :
 * on ne fait jamais pointer une pièce vers un fichier qu'on n'a pas vu. Pour
 * chaque contenu, la clé gardée est celle de la pièce la plus ancienne.
 */
export function planDeDeduplication(
  pieces: readonly PieceStockee[],
  bucket: ReadonlyMap<string, ObjetStocke>,
): PlanDeDeduplication {
  type Cle = {
    key: string;
    hash: string;
    size: number;
    depuis: number;
    n: number;
    sansEmpreinte: boolean;
  };
  const cles = new Map<string, Cle>();
  for (const p of pieces) {
    const objet = bucket.get(p.storageKey);
    if (!objet || !estUneEmpreinte(objet.etag)) continue;
    const c = cles.get(p.storageKey);
    const t = p.createdAt.getTime();
    if (c) {
      c.n += 1;
      c.depuis = Math.min(c.depuis, t);
      c.sansEmpreinte ||= p.contentHash !== objet.etag;
    } else {
      cles.set(p.storageKey, {
        key: p.storageKey,
        hash: objet.etag,
        size: objet.size,
        depuis: t,
        n: 1,
        sansEmpreinte: p.contentHash !== objet.etag,
      });
    }
  }
  const parContenu = new Map<string, Cle[]>();
  for (const c of cles.values()) {
    const contenu = `${c.hash}|${c.size}`;
    (parContenu.get(contenu) ?? parContenu.set(contenu, []).get(contenu)!).push(
      c,
    );
  }
  const plan: PlanDeDeduplication = {
    aNoter: [...cles.values()]
      .filter((c) => c.sansEmpreinte)
      .map((c) => ({ storageKey: c.key, contentHash: c.hash })),
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
  /** Pièces dont l'empreinte a été notée. */
  empreintesNotees: number;
  /** Pièces qui pointent maintenant vers le fichier d'une autre. */
  piecesRepointees: number;
  /** Fichiers mis en file de suppression, et leur poids. */
  fichiersLiberes: number;
  octetsLiberes: number;
};

/**
 * Dédoublonne le stock d'UN compte, d'après le listing du bucket. Dans une
 * seule transaction : l'empreinte des pièces qui n'en ont pas, les doublons
 * qui pointent sur le fichier gardé, et les fichiers abandonnés en file de
 * suppression — un arrêt en chemin ne laisse ni pièce sans fichier, ni fichier
 * sans propriétaire. `simuler` ne fait que compter, par le même plan.
 *
 * Cross-tenant par construction, comme la mesure (`./mesure-stockage`) :
 * appelée seulement derrière `requireAdmin`. Se rejoue sans effet.
 */
export async function dedoublonnerLeCompte(
  accountId: string,
  bucket: ReadonlyMap<string, ObjetStocke>,
  opts: { simuler?: boolean } = {},
): Promise<BilanDeDeduplication> {
  const pieces = await prisma.attachment.findMany({
    where: { accountId, storageKey: { not: null } },
    select: { storageKey: true, contentHash: true, createdAt: true },
  });
  const plan = planDeDeduplication(
    pieces.map((p) => ({ ...p, storageKey: p.storageKey! })),
    bucket,
  );
  const bilan: BilanDeDeduplication = {
    empreintesNotees: 0,
    piecesRepointees: plan.piecesRepointees,
    fichiersLiberes: plan.fichiersLiberes,
    octetsLiberes: plan.octetsLiberes,
  };
  if (opts.simuler) {
    const aNoter = new Set(plan.aNoter.map((n) => n.storageKey));
    bilan.empreintesNotees = pieces.filter((p) =>
      aNoter.has(p.storageKey!),
    ).length;
    return bilan;
  }
  if (plan.aNoter.length === 0 && plan.groupes.length === 0) return bilan;

  const abandonnees = plan.groupes.flatMap((g) => g.abandonnees);
  const gardes = plan.groupes.flatMap((g) => g.abandonnees.map(() => g.garde));
  await prisma.$transaction(
    async (tx) => {
      if (plan.aNoter.length > 0) {
        bilan.empreintesNotees = await tx.$executeRaw`
          UPDATE attachments a
          SET content_hash = v.hash
          FROM unnest(
            ${plan.aNoter.map((n) => n.storageKey)}::text[],
            ${plan.aNoter.map((n) => n.contentHash)}::text[]
          ) AS v(cle, hash)
          WHERE a.account_id = ${accountId}::uuid
            AND a.storage_key = v.cle
            AND a.content_hash IS DISTINCT FROM v.hash
        `;
      }
      if (abandonnees.length > 0) {
        bilan.piecesRepointees = await tx.$executeRaw`
          UPDATE attachments a
          SET storage_key = v.garde
          FROM unnest(${abandonnees}::text[], ${gardes}::text[]) AS v(abandonnee, garde)
          WHERE a.account_id = ${accountId}::uuid
            AND a.storage_key = v.abandonnee
        `;
        // Aucune ligne ne porte plus ces clés : le déclencheur de suppression
        // ne les verra jamais partir. C'est ici qu'elles entrent en file — le
        // drainage vérifie encore, avant d'effacer, que personne ne les tient.
        await tx.$executeRaw`
          INSERT INTO pending_file_deletions (storage_key)
          SELECT unnest(${abandonnees}::text[])
        `;
        // Hors client tenant (la mesure et ce geste sont cross-tenant) : le
        // compte est écrit à la main sur l'entrée de journal.
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
      }
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
  return bilan;
}
