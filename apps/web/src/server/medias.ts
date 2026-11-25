import "server-only";
import {
  type PieceARelire,
  type TenantDb,
  createAttachment,
  getPieceARelire,
  listPiecesACompleter,
  noterPieceIndisponible,
  noterPieceStockee,
} from "@relvo/db";
import { MAX_FILE_SIZE_BYTES, getStorage } from "@relvo/storage";
import { after } from "next/server";
import { MEDIAS, deciderDeLaPiece, type PieceDeMessagerie } from "@/lib/medias";
import { tenantDb } from "@/lib/tenant-db";
import { expireTenantData } from "@/server/cached";
import { type Depot, deposerUnePiece, espaceDuCompte } from "@/server/depot";
import {
  estIntrouvable,
  fetchMessageAttachment,
  getChatMessage,
} from "@/server/unipile/client";
import { piecesDuMessage } from "@/server/unipile/map";
import type { UnipileMessagingAttachmentRef } from "@/server/unipile/types";

// LES MÉDIAS DE LA MESSAGERIE, CÔTÉ APPLICATION (M25.3, M25.5) — « décider
// avant de télécharger ». La règle est dans `lib/medias.ts`, l'état d'une
// pièce dans le domaine (`domain/attachments.ts`) ; ce module fait les trois
// gestes qui touchent le fournisseur et le stockage :
//
//   · À LA RÉCEPTION (`recevoirLesPieces`) : relire ce que l'agrégateur DIT
//     des pièces du message, décider pour chacune, et ne télécharger que ce
//     qui se stocke — le reste entre comme référence ou comme trace.
//   · À L'OUVERTURE (`completerPiece`) : la référence qu'on touche est relue
//     chez l'agrégateur, stockée, et devient une pièce comme une autre.
//   · QUAND UN SUJET PREND LE MESSAGE (`completerLesPiecesPortees`) : ses
//     références se complètent d'elles-mêmes — le plein format pour ce qu'un
//     sujet porte. Lancé après le tri, après les gestes de rattachement, et
//     par les deux crons, qui rattrapent tout le reste.
//
// Seule la MESSAGERIE passe ici : l'e-mail stocke ses pièces à la réception
// (`server/courrier/pieces-jointes.ts`). Un seul fournisseur la porte,
// l'agrégateur.

/** Au-delà, Relvo ne stocke pas une pièce — ni d'elle-même, ni à la demande. */
const POIDS_MAX = MAX_FILE_SIZE_BYTES.attachments;

export type BilanDesPieces = {
  stockees: number;
  references: number;
  traces: number;
  /** Le compte est à son quota (M25.7) : ce qui se serait stocké est entré en référence. */
  auQuota: boolean;
};

/** Le compte est-il à son quota ? Une erreur de mesure ne bloque pas la réception. */
async function estAuQuota(accountId: string): Promise<boolean> {
  try {
    return (await espaceDuCompte(accountId)).plein;
  } catch (err) {
    console.error("[medias] quota illisible, réception sans garde", err);
    return false;
  }
}

/**
 * Les pièces d'un message de messagerie qui vient d'entrer. Ne lève jamais :
 * une pièce qu'on n'a pas su télécharger entre comme référence — elle n'est
 * plus perdue, elle s'ouvrira à la demande.
 */
export async function recevoirLesPieces(
  db: TenantDb,
  args: {
    accountId: string;
    /** Le message chez nous, et le sujet qui l'a capté au rangement. */
    messageId: string;
    subjectId: string | null;
    /** Le message chez l'agrégateur, et ce que son webhook disait des pièces. */
    externalMessageId: string;
    webhook: readonly UnipileMessagingAttachmentRef[];
  },
): Promise<BilanDesPieces> {
  const bilan: BilanDesPieces = {
    stockees: 0,
    references: 0,
    traces: 0,
    auQuota: false,
  };
  let pieces: PieceDeMessagerie[];
  try {
    pieces = piecesDuMessage(
      await getChatMessage(args.externalMessageId),
      args.webhook,
    );
  } catch (err) {
    console.error("[medias] message non relu, pièces du webhook", err);
    pieces = piecesDuMessage(null, args.webhook);
  }

  // Le quota ne se mesure que si une pièce allait se stocker : la plupart des
  // messages n'en ont pas, et une requête de moins compte à chaque webhook.
  const porteeParUnSujet = args.subjectId != null;
  if (
    pieces.some((p) => deciderDeLaPiece(p, { porteeParUnSujet }) === "stocker")
  ) {
    bilan.auQuota = await estAuQuota(args.accountId);
    if (bilan.auQuota) {
      console.info("[medias] compte au quota : pièces gardées en référence", {
        accountId: args.accountId,
      });
    }
  }

  for (const piece of pieces) {
    try {
      const decision = deciderDeLaPiece(piece, {
        porteeParUnSujet,
        auQuota: bilan.auQuota,
      });
      const commun = {
        messageId: args.messageId,
        subjectId: args.subjectId,
        name: piece.nom,
      };
      if (decision === "trace") {
        await createAttachment(db, { ...commun, mimeType: piece.mime });
        bilan.traces += 1;
        continue;
      }
      const stocke =
        decision === "stocker"
          ? await telecharger(db, args.accountId, {
              externalMessageId: args.externalMessageId,
              externalId: piece.id,
              plafond: MEDIAS.plafonds[piece.famille],
            }).catch((err) => {
              console.error("[medias] pièce non téléchargée", piece.id, err);
              return null;
            })
          : null;
      await createAttachment(db, {
        ...commun,
        externalId: piece.id,
        mimeType: stocke?.mime ?? piece.mime,
        storageKey: stocke?.key ?? null,
        fileSize: stocke?.octets ?? piece.taille,
        contentHash: stocke?.empreinte ?? null,
        // Une image stockée se montre elle-même ; la vignette sert à ce qui
        // ne l'est pas, et d'affiche à une vidéo.
        thumbnail: stocke && piece.famille === "image" ? null : piece.vignette,
      });
      if (stocke) bilan.stockees += 1;
      else bilan.references += 1;
    } catch (err) {
      console.error("[medias] pièce non notée", piece.id, err);
    }
  }
  return bilan;
}

/**
 * Lit une pièce chez l'agrégateur et la pose dans le stockage. `null` quand
 * elle dépasse le plafond donné : elle ne se stocke pas, l'appelant en fait
 * une référence. Lève sur tout autre échec.
 */
async function telecharger(
  db: TenantDb,
  accountId: string,
  piece: { externalMessageId: string; externalId: string; plafond: number },
): Promise<(Depot & { mime: string | null }) | null> {
  const { bytes, contentType } = await fetchMessageAttachment({
    messageId: piece.externalMessageId,
    attachmentId: piece.externalId,
  });
  if (bytes.byteLength > Math.min(piece.plafond, POIDS_MAX)) return null;
  // Le dépôt dédoublonne (M25.8) : un fichier que le compte a déjà n'est pas
  // posé une seconde fois, la pièce partage sa clé.
  const depot = await deposerUnePiece(db, accountId, bytes, contentType);
  return { ...depot, mime: contentType };
}

/** Pourquoi une référence n'a pas pu devenir un fichier. */
export type EchecDeCompletion =
  /** Le fournisseur ne la sert plus. */
  | "indisponible"
  /** Plus lourde que ce que Relvo stocke. */
  | "trop_lourde"
  /** Rien ne dit où la relire (une trace, un message sans identifiant). */
  | "sans_source"
  /** Le fournisseur ou le stockage n'a pas répondu : à retenter. */
  | "echec";

export type Completion =
  | { ok: true; storageKey: string }
  | { ok: false; raison: EchecDeCompletion };

/** Une pièce ne se complète qu'une fois à la fois, par instance : l'écran en demande plusieurs lectures d'un coup. */
const enCours = new Map<string, Promise<Completion>>();

/**
 * Fait d'une référence un fichier : la relit chez l'agrégateur, la stocke, et
 * le note au domaine. Sans effet sur une pièce déjà stockée. `insister` :
 * c'est le dirigeant qui l'ouvre — on redemande même une pièce déjà notée
 * indisponible, et le plafond est celui du stockage, pas celui de sa famille.
 */
export function completerPiece(
  accountId: string,
  pieceId: string,
  opts: { insister?: boolean } = {},
): Promise<Completion> {
  const cle = `${accountId}:${pieceId}`;
  const deja = enCours.get(cle);
  if (deja) return deja;
  const travail = completer(accountId, pieceId, opts).finally(() => {
    enCours.delete(cle);
  });
  enCours.set(cle, travail);
  return travail;
}

async function completer(
  accountId: string,
  pieceId: string,
  opts: { insister?: boolean },
): Promise<Completion> {
  const db = tenantDb(accountId);
  const piece = await getPieceARelire(db, pieceId);
  if (!piece) return { ok: false, raison: "sans_source" };
  return completerLaPiece(db, piece, opts);
}

async function completerLaPiece(
  db: TenantDb,
  piece: PieceARelire,
  opts: { insister?: boolean },
): Promise<Completion> {
  if (piece.storageKey) return { ok: true, storageKey: piece.storageKey };
  if (!piece.externalId || !piece.messageExternalId) {
    return { ok: false, raison: "sans_source" };
  }
  if (piece.unavailableAt && !opts.insister) {
    return { ok: false, raison: "indisponible" };
  }
  if (piece.fileSize != null && piece.fileSize > POIDS_MAX) {
    return { ok: false, raison: "trop_lourde" };
  }
  let fichier: Awaited<ReturnType<typeof telecharger>>;
  try {
    fichier = await telecharger(db, piece.accountId, {
      externalMessageId: piece.messageExternalId,
      externalId: piece.externalId,
      plafond: POIDS_MAX,
    });
  } catch (err) {
    if (estIntrouvable(err)) {
      await noterPieceIndisponible(db, piece.id);
      return { ok: false, raison: "indisponible" };
    }
    console.error("[medias] pièce non relue à la source", piece.id, err);
    return { ok: false, raison: "echec" };
  }
  if (!fichier) return { ok: false, raison: "trop_lourde" };
  const note = await noterPieceStockee(db, piece.id, {
    storageKey: fichier.key,
    fileSize: fichier.octets,
    mimeType: fichier.mime,
    contentHash: fichier.empreinte,
  });
  // Une autre lecture a fini avant celle-ci : son fichier reste, le nôtre est
  // de trop. ⚠️ Seulement si c'est NOUS qui l'avons posé : une clé partagée
  // (M25.8) est le fichier d'une autre pièce, on n'y touche jamais.
  if (!note.gagne && !fichier.partagee && fichier.key !== note.storageKey) {
    await getStorage()
      .delete(fichier.key)
      .catch((err) => {
        console.error("[medias] doublon non effacé", fichier.key, err);
      });
  }
  return { ok: true, storageKey: note.storageKey };
}

export type BilanDeCompletion = {
  completees: number;
  indisponibles: number;
  echecs: number;
  /** Références laissées parce que leur compte est à son quota (M25.7). */
  auQuota: number;
  /** Il en restait quand le budget s'est épuisé : le passage suivant les prendra. */
  restantes: boolean;
};

/**
 * Complète les références qu'un sujet porte — d'un compte, ou de tous (le
 * filet des crons) — sous un budget de temps. Chacune sous le plafond de sa
 * famille : une pièce plus lourde reste une référence, qui s'ouvre à la
 * demande. Ne lève jamais.
 */
export async function completerLesPiecesPortees(opts: {
  accountId?: string;
  budgetMs: number;
  limite?: number;
}): Promise<BilanDeCompletion> {
  const debut = Date.now();
  const bilan: BilanDeCompletion = {
    completees: 0,
    indisponibles: 0,
    echecs: 0,
    auQuota: 0,
    restantes: false,
  };
  /** Le quota de chaque compte, lu une fois par passage. */
  const pleins = new Map<string, boolean>();
  const limite = opts.limite ?? 200;
  let pieces: PieceARelire[];
  try {
    pieces = await listPiecesACompleter({
      accountId: opts.accountId,
      plafonds: MEDIAS.plafonds,
      limite,
    });
  } catch (err) {
    console.error("[medias] références à compléter non lues", err);
    return bilan;
  }
  let faites = 0;
  for (const piece of pieces) {
    if (Date.now() - debut > opts.budgetMs) break;
    faites += 1;
    // Au quota, plus rien ne se complète de lui-même : la référence reste, et
    // s'ouvre à la demande.
    let plein = pleins.get(piece.accountId);
    if (plein === undefined) {
      plein = await estAuQuota(piece.accountId);
      pleins.set(piece.accountId, plein);
    }
    if (plein) {
      bilan.auQuota += 1;
      continue;
    }
    const resultat = await completerPiece(piece.accountId, piece.id).catch(
      (err): Completion => {
        console.error("[medias] complétion interrompue", piece.id, err);
        return { ok: false, raison: "echec" };
      },
    );
    if (resultat.ok) bilan.completees += 1;
    else if (resultat.raison === "indisponible") bilan.indisponibles += 1;
    else bilan.echecs += 1;
  }
  bilan.restantes = faites < pieces.length || pieces.length === limite;
  if (bilan.completees > 0) expireTenantData();
  return bilan;
}

/**
 * Après un geste qui donne un sujet à des messages — un rattachement, une
 * écoute ouverte — : compléter leurs références après la réponse. Le geste
 * n'attend pas le fournisseur ; ce que ce budget ne finit pas, les crons le
 * finissent.
 */
export function completerApresLeGeste(accountId: string): void {
  after(async () => {
    const bilan = await completerLesPiecesPortees({
      accountId,
      budgetMs: 40_000,
    });
    if (bilan.completees + bilan.indisponibles + bilan.echecs > 0) {
      console.info("[medias] références complétées après un geste", bilan);
    }
  });
}
