import type { MessageEventItem } from "@relvo/db";
import { formatRelative } from "@/lib/display";

/** Taille de page de la pile Messages (scroll infini). */
export const MESSAGES_PAGE_SIZE = 50;

// Donnée d'affichage d'une ligne de la pile Messages — sérialisable (string),
// pour traverser la frontière Server Action → client (scroll infini). Le temps
// est préformaté côté serveur ; le client reste purement présentationnel.

export type MessageRowData = {
  id: string;
  direction: "incoming" | "outgoing";
  senderName: string;
  senderContactId: string | null;
  senderRaw: string | null;
  recipientName: string;
  recipientContactId: string | null;
  folder: { id: string; name: string; slug: string } | null;
  preview: string;
  content: string | null;
  subjectLine: string | null;
  channelType: string;
  channelName: string;
  channelIdentifier: string;
  time: string;
  read: boolean;
  subject: { id: string; reference: string; title: string } | null;
  attachments: {
    id: string;
    name: string;
    label: string | null;
    mimeType: string | null;
  }[];
};

export function toMessageRowData(item: MessageEventItem): MessageRowData {
  const preview =
    item.content?.replace(/\s+/g, " ").trim() ||
    item.subjectLine?.trim() ||
    "—";
  return {
    id: item.id,
    direction: item.direction,
    senderName: item.senderName,
    senderContactId: item.senderContactId,
    senderRaw: item.senderRaw,
    recipientName: item.recipientName,
    recipientContactId: item.recipientContactId,
    folder: item.folder,
    preview,
    content: item.content,
    subjectLine: item.subjectLine,
    channelType: item.channelType,
    channelName: item.channelName,
    channelIdentifier: item.channelIdentifier,
    time: formatRelative(item.receivedAt) ?? "",
    read: item.read,
    subject: item.subject,
    attachments: item.attachments,
  };
}
