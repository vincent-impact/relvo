import type {
  ChannelType,
  ConversationFilter,
  ConversationListItem,
  ConversationMessageItem,
  ConversationTriage,
  UnimportedGap,
} from "@relvo/db";
import type { EtatPiece } from "@/lib/pieces";
import type { TrouData } from "@/lib/trou";
import { formatRelative } from "@/lib/display";

// ── Ce que Relvo a conclu sur un fil (M7) ───────────────────────────────────
// Deux informations, jamais mêlées — deux badges à l'écran (`avis-badges`) :
//   · le CONSEIL : ce que Relvo en ferait. C'est lui qui guide d'un coup
//     d'œil ; il n'a de sens que tant que la conversation est à trier — une
//     conversation ignorée n'attend plus d'avis.
//   · la NATURE : de quoi il s'agit (professionnel, publicité…). Elle se lit
//     partout où l'avis s'affiche, « à trier » comme « ignorées ».
// Les mots sont ceux de l'utilisateur, en un seul endroit, jamais ceux du
// modèle ni de la base : « bruit » ne s'affiche nulle part.

/** Ce que Relvo en ferait. Sans avis, il n'a pas lu la conversation. */
export type Conseil = "traiter" | "ignorer";

export const CONSEIL_LABELS: Record<Conseil, string> = {
  traiter: "À traiter",
  ignorer: "À ignorer",
};

export const SANS_AVIS = "Sans avis";

// Un seul conseil pour « à traiter » et « à considérer » : dans les deux cas
// Relvo dit au dirigeant de regarder. La nuance — sûr ou hésitant — est dans
// sa phrase, en tête du fil.
const CONSEIL_DE: Record<ConversationTriage["verdict"], Conseil> = {
  matter: "traiter",
  uncertain: "traiter",
  noise: "ignorer",
};

/** La nature que Relvo pose sur une conversation — miroir de `TriageNature`. */
export type NatureCle = NonNullable<ConversationTriage["nature"]>;

export const NATURE_LABELS: Record<NatureCle, string> = {
  professional: "Professionnel",
  personal: "Personnel",
  advertising: "Publicité",
  automatic: "E-mail automatique",
  unwanted: "Indésirable",
};

/**
 * La nature, dite pour le canal de la conversation. « Automatique » tout seul
 * ne disait pas quoi : sur un e-mail c'est un « E-mail automatique » ; sur un
 * fil de messagerie — une notification de livraison, un code de connexion —
 * un « Message automatique ». Les autres natures se disent pareil partout.
 */
export function libelleDeNature(nature: NatureCle, canal: string): string {
  if (nature === "automatic" && canal !== "email") return "Message automatique";
  return NATURE_LABELS[nature];
}

/** L'avis de Relvo, prêt à afficher — sérialisable (le temps est préformaté). */
export type RelvoVerdictData = {
  conseil: Conseil;
  nature: NatureCle | null;
  /** La phrase de Relvo — elle se lit en tête du fil, jamais dans la liste. */
  reason: string;
  /** « 35 min », « hier »… */
  time: string;
};

export function toRelvoVerdictData(
  t: ConversationTriage | null,
): RelvoVerdictData | null {
  if (!t) return null;
  return {
    conseil: CONSEIL_DE[t.verdict],
    nature: t.nature,
    reason: t.reason,
    time: formatRelative(t.at) ?? "",
  };
}

/**
 * L'ignorance, prête à afficher : QUI a ignoré, et la nature que Relvo avait
 * posée — elle reste vraie quand c'est l'utilisateur qui a ignoré.
 */
export type IgnoreData = {
  byRelvo: boolean;
  nature: NatureCle | null;
  note: string | null;
  /** Ce que la conversation n'importe plus depuis qu'elle est ignorée (M25.10) — dit en tête du fil. */
  unimported: TrouData | null;
};

/** Le compte de ce qui n'a pas été importé, la date prête à lire. */
export function toTrouData(u: UnimportedGap | null): TrouData | null {
  if (!u) return null;
  return {
    count: u.count,
    since:
      u.since?.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      }) ?? null,
  };
}

export function toIgnoreData(
  i: ConversationListItem["ignore"],
  triage: ConversationTriage | null,
  unimported: UnimportedGap | null = null,
): IgnoreData | null {
  if (!i) return null;
  return {
    byRelvo: i.by === "ai",
    nature: triage?.nature ?? null,
    note: i.note,
    unimported: toTrouData(unimported),
  };
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
  /** Le dirigeant y est mentionné dans un message non lu (M29.2). */
  mentioned: boolean;
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
    mentioned: item.mentioned,
    ignored: item.status === "ignored",
    listeningSubjects: item.listeningSubjects,
    relvo: toRelvoVerdictData(item.triage),
    ignore: toIgnoreData(item.ignore, item.triage, item.unimported),
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
  /** TOUTES les pièces du message, dans l'ordre où elles sont arrivées. */
  attachments: {
    id: string;
    name: string;
    label: string | null;
    mimeType: string | null;
    /** Où en est la pièce (M25.3) : stockée, gardée en référence, trace… */
    etat: EtatPiece;
    vignette: string | null;
    taille: number | null;
  }[];
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
    // Toutes : la conversation est la seule surface où un message se lit, une
    // pièce qui n'y paraît pas n'existe nulle part pour le dirigeant.
    attachments: m.attachments,
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
