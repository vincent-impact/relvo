import type {
  ChannelType,
  ConversationFilter,
  ConversationListItem,
  ConversationMessageItem,
  ConversationTriage,
} from "@relvo/db";
import { formatRelative } from "@/lib/display";

// ── Ce que Relvo a conclu sur un fil (M7) ───────────────────────────────────
// Libellés FRANÇAIS de l'avis — l'ACTION et la NATURE — et des raisons
// d'ignorance, en un seul endroit : la liste et le fil parlent la même langue,
// celle de l'utilisateur, jamais celle du modèle ni de la base.

export const ACTION_LABELS: Record<ConversationTriage["verdict"], string> = {
  matter: "À traiter",
  uncertain: "À considérer",
  noise: "Rien à faire",
};

export const NATURE_LABELS: Record<
  NonNullable<ConversationTriage["nature"]>,
  string
> = {
  professional: "professionnel",
  advertising: "publicité",
  automatic: "automatique",
  personal: "personnel",
};

/** Les raisons que l'utilisateur choisit d'un appui. */
export const IGNORE_REASON_LABELS: Record<string, string> = {
  advertising: "publicité",
  prospecting: "prospection",
  automatic: "automatique",
  personal: "personnel",
  not_my_role: "pas mon rôle",
  handled_elsewhere: "traité ailleurs",
  other: "autre",
};

/** Le verdict de Relvo, prêt à afficher — sérialisable (le temps est préformaté). */
export type RelvoVerdictData = {
  verdict: ConversationTriage["verdict"];
  /** « À traiter · professionnel », « Rien à faire · publicité ». */
  label: string;
  reason: string;
  /** « 35 min », « hier »… */
  time: string;
};

export function toRelvoVerdictData(
  t: ConversationTriage | null,
): RelvoVerdictData | null {
  if (!t) return null;
  const base = ACTION_LABELS[t.verdict];
  const label = t.nature ? `${base} · ${NATURE_LABELS[t.nature]}` : base;
  return {
    verdict: t.verdict,
    label,
    reason: t.reason,
    time: formatRelative(t.at) ?? "",
  };
}

/**
 * L'ignorance, prête à afficher : « Ignorée par Relvo · publicité » — la
 * NATURE de l'avis quand c'est Relvo qui a fait taire, la raison choisie
 * quand c'est l'utilisateur.
 */
export type IgnoreData = {
  byRelvo: boolean;
  reasonLabel: string | null;
  note: string | null;
};

export function toIgnoreData(
  i: ConversationListItem["ignore"],
  triage: ConversationTriage | null,
): IgnoreData | null {
  if (!i) return null;
  const byRelvo = i.by === "ai";
  const reasonLabel = byRelvo
    ? triage?.nature
      ? NATURE_LABELS[triage.nature]
      : null
    : i.reason
      ? (IGNORE_REASON_LABELS[i.reason] ?? i.reason)
      : null;
  return { byRelvo, reasonLabel, note: i.note };
}

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
  type: string;
  /** Contact rattaché (null = non enregistré → avatar icône + création). */
  contactId: string | null;
  interlocutorName: string | null;
  interlocutorRaw: string | null;
  unreadCount: number;
  ignored: boolean;
  /** Sujets écoutant encore ce fil — nomment la confirmation du swipe gauche. */
  listeningSubjects: { id: string; title: string }[];
  /** Le dernier verdict de Relvo, ou null s'il n'a pas encore lu ce fil. */
  relvo: RelvoVerdictData | null;
  /** Raison et auteur de l'ignorance (filtre « Ignorées »), sinon null. */
  ignore: IgnoreData | null;
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
    type: item.type,
    contactId: item.contactId,
    interlocutorName: item.interlocutorName,
    interlocutorRaw: item.interlocutorRaw,
    unreadCount: item.unreadCount,
    ignored: item.status === "ignored",
    listeningSubjects: item.listeningSubjects,
    relvo: toRelvoVerdictData(item.triage),
    ignore: toIgnoreData(item.ignore, item.triage),
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
  suivies: "followed",
  ignorees: "ignored",
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
