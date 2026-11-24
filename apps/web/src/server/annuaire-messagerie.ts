import "server-only";
import {
  annuaireDesMentions,
  idsDesMentions,
  mentionneLeDirigeant,
  noterIdentites,
} from "@relvo/db";
import type { TenantDb } from "@/lib/tenant-db";
import { listChatAttendees } from "@/server/unipile";
import { identiteDuParticipant } from "@/server/unipile/map";

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
 * Ce message mentionne-t-il le dirigeant ? Sans modèle : les identifiants du
 * texte, lus dans l'annuaire du canal — complété une fois par les
 * participants du fil si l'un d'eux y est inconnu (c'est aussi là qu'on
 * apprend lequel est le dirigeant).
 */
export async function mentionDuDirigeant(
  db: TenantDb,
  args: { channelId: string; chatId: string | null; content: string | null },
): Promise<boolean> {
  const ids = idsDesMentions(args.content);
  if (ids.length === 0) return false;
  let annuaire = await annuaireDesMentions(db, ids, {
    channelId: args.channelId,
  });
  const inconnus = ids.filter((id) => !annuaire.has(id));
  if (inconnus.length > 0 && args.chatId) {
    await completerAnnuaire(db, {
      channelId: args.channelId,
      chatId: args.chatId,
      inconnus,
    });
    annuaire = await annuaireDesMentions(db, ids, {
      channelId: args.channelId,
    });
  }
  return mentionneLeDirigeant(args.content, annuaire);
}
