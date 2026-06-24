"use client";

import { useEffect, useRef } from "react";
import { markMessageReadAction } from "@/server/actions/messages";

// Ouvrir la page d'un message vaut lecture : on pose readAt une seule fois au
// montage (effet de bord, pas de rendu). Pendant de l'AcknowledgeOnOpen des sujets.

export function MarkReadOnOpen({ messageId }: { messageId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markMessageReadAction(messageId);
  }, [messageId]);
  return null;
}
