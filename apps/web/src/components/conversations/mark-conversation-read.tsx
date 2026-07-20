"use client";

import { useEffect, useRef } from "react";
import { markConversationReadAction } from "@/server/actions/conversations";

// Ouvrir une conversation vaut lecture de ses messages entrants (acquittement
// implicite, invariant n°10) : on pose `readAt` une seule fois au montage —
// effet de bord, pas de rendu. Pendant du MarkReadOnOpen de /messages/[id],
// mais à la maille de la SOURCE : c'est là que le non-lu vit désormais, et
// c'est ce qui fait qu'aucun message ne reste non-lu faute de sujet.

export function MarkConversationRead({
  conversationId,
}: {
  conversationId: string;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markConversationReadAction(conversationId);
  }, [conversationId]);
  return null;
}
