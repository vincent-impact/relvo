import "server-only";
import {
  annuaireDesMentions,
  cleIdentite,
  estUnEnvoiDuDirigeant,
  idsDesMentions,
  mentionneLeDirigeant,
  noterIdentites,
} from "@relvo/db";
import type { TenantDb } from "@/lib/tenant-db";
import { getChatMessage, listChatAttendees } from "@/server/unipile";
import { identiteDuParticipant } from "@/server/unipile/map";
import type { UnipileQuoted } from "@/server/unipile/types";

// L'ANNUAIRE DES IDENTIFIANTS, CÔTÉ FOURNISSEUR (M29.1). Le domaine tient
// l'annuaire (`domain/annuaire-messagerie`) ; ce fichier le NOURRIT de ce que
// l'agrégateur sait : l'expéditeur que porte chaque webhook, et la liste des
// participants d'un fil quand une mention désigne quelqu'un d'inconnu. Les
// traductions pures sont dans `unipile/map` (`identiteDuWebhook`,
// `identiteDuParticipant`).
//
// La liste des participants coûte un appel réseau : on ne la demande que pour
// des identifiants que l'annuaire ne connaît pas DU TOUT, et ceux qu'elle ne
// rend pas sont notés sans nom — on ne les redemande plus.

/**
 * Va chercher chez le fournisseur les participants d'un fil et les note ; ce
 * que la liste ne rend pas parmi `inconnus` est noté sans nom. Ne lève pas :
 * une mention reste en chiffres si le fournisseur ne répond pas.
 */
export async function completerAnnuaire(
  db: TenantDb,
  args: { channelId: string; chatId: string; inconnus: readonly string[] },
): Promise<void> {
  try {
    const participants = await listChatAttendees(args.chatId);
    await noterIdentites(db, args.channelId, [
      ...participants.map(identiteDuParticipant),
      // Après les participants : ne note sans nom que ce qu'ils n'ont pas appris.
      ...args.inconnus.map((internalId) => ({ internalId })),
    ]);
  } catch (err) {
    console.warn("[annuaire] participants du fil illisibles", args.chatId, err);
  }
}

/**
 * L'annuaire du canal pour ces identifiants — complété une fois par les
 * participants du fil si l'un d'eux y est inconnu (c'est aussi là qu'on
 * apprend lequel est le dirigeant).
 */
async function annuaireComplete(
  db: TenantDb,
  args: { channelId: string; chatId: string | null; ids: readonly string[] },
) {
  const annuaire = await annuaireDesMentions(db, args.ids, {
    channelId: args.channelId,
  });
  const inconnus = args.ids.filter((id) => !annuaire.has(id));
  if (inconnus.length === 0 || !args.chatId) return annuaire;
  await completerAnnuaire(db, {
    channelId: args.channelId,
    chatId: args.chatId,
    inconnus,
  });
  return annuaireDesMentions(db, args.ids, { channelId: args.channelId });
}

/**
 * Ce message mentionne-t-il le dirigeant ? Sans modèle : les identifiants du
 * texte, lus dans l'annuaire du canal.
 */
export async function mentionDuDirigeant(
  db: TenantDb,
  args: { channelId: string; chatId: string | null; content: string | null },
): Promise<boolean> {
  const ids = idsDesMentions(args.content);
  if (ids.length === 0) return false;
  const annuaire = await annuaireComplete(db, { ...args, ids });
  return mentionneLeDirigeant(args.content, annuaire);
}

/**
 * LA RÉPONSE AU DIRIGEANT (M29.7). Ce message de groupe répond-il, en le
 * citant, à un message du dirigeant ? Rend le texte cité (vide s'il n'en avait
 * pas), ou `null` si ce n'est pas le cas. Sans modèle :
 *
 *   · le message cité est un envoi que Relvo a vu partir ; sinon
 *   · son auteur est « c'est moi » dans l'annuaire du canal.
 *
 * Ce que le message cite vient du webhook quand il le porte, sinon d'une
 * relecture du message chez l'agrégateur. Ne lève pas : un fournisseur muet
 * laisse le message sans mention, il ne l'empêche pas d'entrer.
 */
export async function reponseAuDirigeant(
  db: TenantDb,
  args: {
    channelId: string;
    chatId: string | null;
    messageExternalId: string | null | undefined;
    /** Ce que le webhook dit du message cité ; `undefined` s'il n'en dit rien. */
    quoted: UnipileQuoted | null | undefined;
  },
): Promise<string | null> {
  try {
    let quoted = args.quoted;
    if (quoted === undefined && args.messageExternalId) {
      quoted = (await getChatMessage(args.messageExternalId))?.quoted;
    } else if (quoted !== undefined) {
      // À constater en production : le webhook porte-t-il ce champ de lui-même ?
      console.info("[citation] dite par le webhook", { cite: quoted !== null });
    }
    if (!quoted) return null;
    if (await estUnEnvoiDuDirigeant(db, quoted.message_id)) {
      return quoted.text ?? "";
    }
    const auteur = cleIdentite(quoted.sender_id);
    if (!auteur) return null;
    const annuaire = await annuaireComplete(db, { ...args, ids: [auteur] });
    return annuaire.get(auteur)?.isSelf ? (quoted.text ?? "") : null;
  } catch (err) {
    console.warn("[citation] message cité illisible", args.chatId, err);
    return null;
  }
}
