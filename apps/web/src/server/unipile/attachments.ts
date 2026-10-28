import type { TenantDb } from "@relvo/db";
import { stockerPiecesJointes as stocker } from "@/server/courrier/pieces-jointes";
import { pieceDepuisUnipile } from "./courrier";
import { fournisseurUnipile } from "./fournisseur";
import type { UnipileAttachmentRef } from "./types";

// Les pièces jointes d'un e-mail de l'AGRÉGATEUR, dans les mots de l'agrégateur
// — pour le script `pj:rattraper`, qui relit des e-mails chez lui. Le travail
// est celui de la frontière (`server/courrier/pieces-jointes.ts`, M24.6) :
// ce module ne fait que traduire.

export function stockerPiecesJointes(
  db: TenantDb,
  args: {
    accountId: string;
    /** Compte Unipile (`account_id`) et identifiant de l'e-mail chez lui. */
    unipileAccountId: string;
    emailId: string;
    messageId: string;
    subjectId: string | null;
    attachments: readonly UnipileAttachmentRef[];
  },
): Promise<number> {
  return stocker(db, {
    fournisseur: fournisseurUnipile,
    accountId: args.accountId,
    externalAccountId: args.unipileAccountId,
    emailId: args.emailId,
    messageId: args.messageId,
    subjectId: args.subjectId,
    pieces: args.attachments.map(pieceDepuisUnipile),
  });
}
