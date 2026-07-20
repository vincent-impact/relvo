"use server";

import {
  type ConversationFilter,
  ChannelType,
  ignoreConversation,
  listConversationItems,
  markConversationRead,
  reactivateConversation,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";
import {
  CONVERSATIONS_PAGE_SIZE,
  type ConversationRowData,
  toConversationRowData,
} from "@/lib/conversation-row";

// Server Actions Conversations (M6bis.8) — la surface de tri. On n'ignore plus
// un MESSAGE (cf. `messages.ts`) mais une SOURCE : c'est le remède au « groupe
// WhatsApp bavard », et c'est réversible par le seul utilisateur.

function revalidateConversations() {
  revalidatePath("/conversations");
  revalidatePath("/conversations/[id]", "page");
  // Le KPI « Sans sujet » de la page Sujets compte des conversations : ignorer
  // ou réactiver une source le fait bouger immédiatement.
  revalidatePath("/fil");
  revalidateTenantData();
}

export async function ignoreConversationAction(id: string) {
  const result = await domainAction((db) => ignoreConversation(db, id));
  if (result.ok) revalidateConversations();
  return result;
}

export async function reactivateConversationAction(id: string) {
  const result = await domainAction((db) => reactivateConversation(db, id));
  if (result.ok) revalidateConversations();
  return result;
}

/**
 * Ouvrir une conversation vaut lecture de ses messages entrants (acquittement
 * implicite, invariant n°10). Appelée au montage de la page détail.
 */
export async function markConversationReadAction(id: string) {
  const result = await domainAction((db) => markConversationRead(db, id));
  // Rien à revalider si aucun message n'a changé d'état : l'ouverture d'une
  // conversation déjà lue ne doit pas coûter une invalidation de cache.
  if (result.ok && result.data.messagesRead > 0) {
    revalidatePath("/conversations");
    revalidateTenantData(); // les non-lus alimentent les pastilles ailleurs
  }
  return result;
}

/** Page suivante de la liste (scroll infini, côté client). */
export async function loadConversationsAction(
  filter: ConversationFilter,
  channelType: ChannelType | null,
  cursor: string | null,
): Promise<
  | {
      ok: true;
      data: { items: ConversationRowData[]; nextCursor: string | null };
    }
  | { ok: false; message: string }
> {
  const res = await domainAction((db) =>
    listConversationItems(db, {
      filter,
      ...(channelType ? { channelType } : {}),
      cursor: cursor ?? undefined,
      limit: CONVERSATIONS_PAGE_SIZE,
    }),
  );
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      items: res.data.items.map(toConversationRowData),
      nextCursor: res.data.nextCursor,
    },
  };
}
