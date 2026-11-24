import "server-only";
import {
  ConversationType,
  closeUnimportedGap,
  emailConversationKey,
  getUnimportedGap,
  recevoirWhatsAppEntrant,
  recevoirWhatsAppSortant,
  type TenantDb,
  type TrouARelire,
} from "@relvo/db";
import { after } from "next/server";
import { tenantDb } from "@/lib/tenant-db";
import { type Boite, fournisseurDe, rangerCourrier } from "@/server/courrier";
import { relireApresSalve } from "@/server/ia/pipeline/relecture";
import { trierConversation } from "@/server/ia/pipeline/tri";

// LE RETOUR D'UNE CONVERSATION IGNORÉE (M25.10) — « ce qu'on ne lit plus se
// relit au retour ».
//
// Une conversation réactivée, ou rattachée à un sujet, porte encore le compte
// de ce qu'elle n'a pas importé : c'est son TROU. Cette fonction va le relire
// chez le fournisseur du canal, range ce qu'elle retrouve par la réception
// ordinaire (idempotente — relire deux fois ne duplique rien), puis solde le
// trou. Elle répond à un geste du dirigeant, donc elle est bornée en temps et
// en volume : ce qui dépasse reste un trou, que l'écran propose de relire.
//
// Ce qui revient : le TEXTE. Un message de messagerie sans texte — une photo,
// un vocal — n'est pas rapatrié (M25 : un média ne se stocke que pour ce qu'un
// sujet porte) ; il est compté comme non retrouvé, et Relvo le dit. L'e-mail
// garde ses pièces jointes, comme à la réception. Les envois du dirigeant
// depuis son client de messagerie ne sont pas relus : le fournisseur liste la
// boîte de réception.

/** Budget d'un retour : le dirigeant attend la réponse de son geste. */
const BUDGET_MS = 20_000;
const PAGES_MAX = 5;

export type BilanRetour = {
  /** Combien de messages la conversation n'avait pas importés. */
  attendus: number;
  /** Combien sont entrés. */
  retrouves: number;
  /** Faux : la lecture s'est arrêtée avant la fin, le trou reste à relire. */
  complet: boolean;
};

type Relu = {
  retrouves: number;
  complet: boolean;
  /** Le dernier message reçu entré — celui qui portera le tri ou la relecture. */
  dernierEntrant: { id: string; subjectId: string | null } | null;
};

async function relireMessagerie(
  db: TenantDb,
  trou: TrouARelire,
  fin: number,
): Promise<Relu> {
  const chatId = trou.externalThreadId;
  if (!chatId) return { retrouves: 0, complet: true, dernierEntrant: null };
  const { listChatAttendees, listChatMessages } =
    await import("@/server/unipile/client");
  const { annuaireDuFil, messageRelu } = await import("@/server/unipile/map");
  const groupe = trou.type === ConversationType.whatsapp_group;
  const annuaire = annuaireDuFil(groupe ? await listChatAttendees(chatId) : []);

  // L'agrégateur liste du plus récent au plus ancien : on ramasse, puis on
  // range dans l'ordre du temps, pour que le dernier rangé soit le dernier dit.
  const items = [];
  let cursor: string | null = null;
  let complet = false;
  for (let page = 0; page < PAGES_MAX && Date.now() < fin; page += 1) {
    const lu = await listChatMessages({
      chatId,
      after: new Date(trou.since.getTime() - 1000),
      cursor,
    });
    items.push(...lu.items);
    cursor = lu.cursor;
    if (!cursor) {
      complet = true;
      break;
    }
  }
  items.reverse();

  let retrouves = 0;
  let dernierEntrant: Relu["dernierEntrant"] = null;
  for (const item of items) {
    if (Date.now() >= fin) return { retrouves, complet: false, dernierEntrant };
    const relu = messageRelu(item, {
      channelId: trou.channelId,
      chatId,
      groupe,
      interlocuteur: trou.interlocutorRaw,
      annuaire,
    });
    if (relu.sens === "laisse") continue;
    if (relu.sens === "envoye") {
      const r = await recevoirWhatsAppSortant(db, relu.sortant);
      if (!r.ecartee && r.created) retrouves += 1;
      continue;
    }
    const r = await recevoirWhatsAppEntrant(db, relu.entrant);
    if (r.ecartee || !r.created) continue;
    retrouves += 1;
    dernierEntrant = { id: r.message.id, subjectId: r.message.subjectId };
  }
  return { retrouves, complet, dernierEntrant };
}

async function relireCourrier(
  db: TenantDb,
  accountId: string,
  trou: TrouARelire,
  fin: number,
): Promise<Relu> {
  const config = await db.channelConfig.findFirst({
    where: { channelId: trou.channelId },
    select: {
      provider: true,
      externalAccountId: true,
      channel: { select: { identifier: true } },
    },
  });
  const avec = trou.participantsRaw[0] ?? trou.interlocutorRaw;
  if (!config?.externalAccountId || !avec) {
    return { retrouves: 0, complet: true, dernierEntrant: null };
  }
  const fournisseur = await fournisseurDe(config.provider);
  const boite: Boite = {
    accountId,
    channelId: trou.channelId,
    externalAccountId: config.externalAccountId,
    nosAdresses: [config.channel.identifier],
  };

  let retrouves = 0;
  let dernierEntrant: Relu["dernierEntrant"] = null;
  let cursor: string | null = null;
  for (let page = 0; page < PAGES_MAX; page += 1) {
    if (Date.now() >= fin) return { retrouves, complet: false, dernierEntrant };
    const lu = await fournisseur.lireRecents(boite, {
      after: new Date(trou.since.getTime() - 60_000),
      cursor,
      limit: 50,
      avec,
    });
    const connus = new Set(
      (
        await db.message.findMany({
          where: {
            channelId: trou.channelId,
            externalId: { in: lu.items.map((i) => i.externalId) },
          },
          select: { externalId: true },
        })
      ).map((m) => m.externalId),
    );
    for (const item of lu.items) {
      if (connus.has(item.externalId)) continue;
      if (Date.now() >= fin) {
        return { retrouves, complet: false, dernierEntrant };
      }
      const courrier = await item.lire();
      if (!courrier || courrier.nature !== "recu") continue;
      // L'interlocuteur écrit sur d'autres fils : seul le courrier de CETTE
      // conversation entre — le reste appartient à des fils qui ont leur
      // propre état, ignoré ou non.
      const cle = await emailConversationKey(db, {
        channelId: trou.channelId,
        interlocutorRaw: courrier.entrant.senderRaw,
        recipients: courrier.entrant.recipients,
        subjectLine: courrier.entrant.subjectLine,
      });
      if (cle !== trou.key) continue;
      const range = await rangerCourrier(db, boite, courrier, fournisseur);
      if (!range.created || !range.messageId) continue;
      retrouves += 1;
      dernierEntrant = { id: range.messageId, subjectId: range.subjectId };
    }
    cursor = lu.cursor;
    if (!cursor) return { retrouves, complet: true, dernierEntrant };
  }
  return { retrouves, complet: false, dernierEntrant };
}

/**
 * Relit le trou d'une conversation redevenue active. `null` : il n'y avait
 * rien à relire. N'échoue jamais vers l'appelant — un fournisseur injoignable
 * laisse le trou en place, journalisé, et l'écran propose de recommencer.
 */
export async function relireLeTrou(
  accountId: string,
  conversationId: string,
): Promise<BilanRetour | null> {
  const db = tenantDb(accountId);
  const trou = await getUnimportedGap(db, conversationId);
  if (!trou) return null;
  let relu: Relu;
  try {
    const fin = Date.now() + BUDGET_MS;
    relu =
      trou.type === ConversationType.email_subject
        ? await relireCourrier(db, accountId, trou, fin)
        : await relireMessagerie(db, trou, fin);
  } catch (err) {
    console.error("[retour] trou non relu", { accountId, conversationId }, err);
    return { attendus: trou.count, retrouves: 0, complet: false };
  }
  if (relu.complet) {
    await closeUnimportedGap(db, conversationId, { recovered: relu.retrouves });
  }
  // Ce qui vient d'entrer se lit comme un message qui arrive : la relecture du
  // sujet qui l'a capté, sinon le tri — après la réponse, avec leur salve.
  const dernier = relu.dernierEntrant;
  if (dernier) {
    after(async () => {
      const resultat = dernier.subjectId
        ? await relireApresSalve({
            accountId,
            subjectId: dernier.subjectId,
            conversationId,
            messageId: dernier.id,
          })
        : await trierConversation({
            accountId,
            conversationId,
            messageId: dernier.id,
          });
      console.info("[retour] lu", { accountId, conversationId, ...resultat });
    });
  }
  return {
    attendus: trou.count,
    retrouves: relu.retrouves,
    complet: relu.complet,
  };
}
