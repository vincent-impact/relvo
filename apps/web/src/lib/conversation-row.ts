import type {
  ChannelType,
  ConversationFilter,
  ConversationListItem,
  ConversationMessageItem,
} from "@relvo/db";
import { formatRelative } from "@/lib/display";

/** Taille de page de la liste Conversations (scroll infini). */
export const CONVERSATIONS_PAGE_SIZE = 50;

// Donnée d'affichage d'une ligne de /conversations — entièrement SÉRIALISABLE
// (aucune Date), pour traverser la frontière Server Action → client lors du
// scroll infini. Le temps est préformaté côté serveur ; le client reste
// purement présentationnel. Même contrat que `message-row.ts`.

export type ConversationRowData = {
  id: string;
  title: string;
  preview: string;
  /** Horodatage relatif préformaté (« 35 min », « hier », « 12 juin »). */
  time: string;
  channelType: string;
  unreadCount: number;
  ignored: boolean;
  /** Sujets écoutant encore ce fil — nomment la confirmation du swipe gauche. */
  listeningSubjects: { id: string; title: string }[];
};

export function toConversationRowData(
  item: ConversationListItem,
): ConversationRowData {
  return {
    id: item.id,
    title: item.title,
    preview: item.preview,
    time: formatRelative(item.lastMessageAt) ?? "",
    channelType: item.channelType,
    unreadCount: item.unreadCount,
    ignored: item.status === "ignored",
    listeningSubjects: item.listeningSubjects,
  };
}

// ── Fil d'une conversation ──────────────────────────────────────────────────

export type ThreadMessageData = {
  id: string;
  direction: "incoming" | "outgoing";
  senderName: string;
  content: string;
  /** Corps HTML d'un e-mail (rendu isolé), ou null → repli texte. */
  contentHtml: string | null;
  time: string;
  /** Sujet couvrant ce message — porte AUSSI la matière du cordon (domaine). */
  subject: {
    id: string;
    reference: string;
    title: string;
    folder: { slug: string; color: string | null; icon: string | null } | null;
  } | null;
  attachment: {
    id: string;
    name: string;
    label: string | null;
    mimeType: string | null;
  } | null;
};

export function toThreadMessageData(
  m: ConversationMessageItem,
): ThreadMessageData {
  return {
    id: m.id,
    direction: m.direction,
    senderName: m.senderName,
    content: m.content ?? "",
    contentHtml: m.contentHtml,
    time: formatRelative(m.sentAt) ?? "",
    subject: m.subject,
    // Une seule pièce jointe rendue sous la bulle, comme dans le fil d'un sujet
    // (la fiche du message porte le détail complet).
    attachment: m.attachments[0] ?? null,
  };
}

// ── Filtres portés par l'URL ────────────────────────────────────────────────
// L'URL est la source de vérité du filtre : la page reste LINKABLE (le KPI
// « Sans sujet » pointe droit sur `?filtre=sans-sujet`), le retour arrière
// retrouve le bon onglet, et c'est la base qui filtre — pas le navigateur.

export const CONVERSATION_FILTER_SLUGS = {
  "sans-sujet": "unsorted",
  ignorees: "ignored",
  toutes: "all",
} as const satisfies Record<string, ConversationFilter>;

export type ConversationFilterSlug = keyof typeof CONVERSATION_FILTER_SLUGS;

export function parseFilterSlug(raw?: string | null): ConversationFilterSlug {
  return raw && raw in CONVERSATION_FILTER_SLUGS
    ? (raw as ConversationFilterSlug)
    : "sans-sujet";
}

// Filtre CANAL (`?canal=`) — rétabli le 2026-07-24 à la demande produit : sur une
// surface de tri, pouvoir isoler « seulement mes e-mails » ou « seulement
// WhatsApp » aide quand un canal domine le flux. « tous » = pas de contrainte.
export const CONVERSATION_CHANNEL_SLUGS = {
  tous: undefined,
  email: "email",
  whatsapp: "whatsapp",
} as const satisfies Record<string, ChannelType | undefined>;

export type ConversationChannelSlug = keyof typeof CONVERSATION_CHANNEL_SLUGS;

export function parseChannelSlug(raw?: string | null): ConversationChannelSlug {
  return raw && raw in CONVERSATION_CHANNEL_SLUGS
    ? (raw as ConversationChannelSlug)
    : "tous";
}
