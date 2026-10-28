import type {
  Boite,
  CourrierEntrant,
  PieceJointeRef,
} from "@/server/courrier/types";
import {
  natureDuCourrier,
  toEmailHeaders,
  toInboundEmail,
  toOutboundEmail,
} from "./map";
import type { UnipileAttachmentRef, UnipileMailWebhook } from "./types";

// L'agrégateur → la forme PIVOT de la frontière (M24.1). Un webhook de
// courrier — ou une ligne d'API passée par `apiMailToWebhook` — devient un
// `CourrierEntrant` : sa nature d'après `role` et `folders` (#69), l'entrée du
// domaine qui va avec, ses pièces jointes. Mapper PUR, testable sans réseau.

export function pieceDepuisUnipile(att: UnipileAttachmentRef): PieceJointeRef {
  return {
    id: att.id,
    name: att.name ?? null,
    mime: att.mime ?? att.content_type ?? null,
    size: att.size ?? null,
  };
}

export function courrierDepuisUnipile(
  mail: UnipileMailWebhook,
  boite: Pick<Boite, "channelId" | "nosAdresses">,
): CourrierEntrant {
  const nature = natureDuCourrier(mail, boite.nosAdresses);
  const date = mail.date ?? null;
  if (nature === "brouillon" || nature === "ecarte") {
    return {
      nature,
      externalId: mail.email_id,
      date,
      motif: mail.role ?? null,
    };
  }
  const pieces = (mail.attachments ?? []).map(pieceDepuisUnipile);
  if (nature === "envoye") {
    return {
      nature,
      externalId: mail.email_id,
      date,
      sortant: toOutboundEmail(mail, boite.channelId),
      pieces,
    };
  }
  return {
    nature,
    externalId: mail.email_id,
    date,
    entrant: toInboundEmail(mail, boite.channelId),
    pieces,
    entetes: toEmailHeaders(mail),
  };
}
