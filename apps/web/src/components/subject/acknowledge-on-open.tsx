"use client";

import { useEffect, useRef } from "react";
import { openSubjectAction } from "@/server/actions/subjects";

// Acquittement implicite (M9.16 / invariant n°10) : ouvrir la fiche d'un sujet
// pose lastOpenedAt, ce qui lève le marqueur dérivé « Nouveau » (le statut
// ne change pas). Effet de bord au montage, une seule fois — pas de rendu.

export function AcknowledgeOnOpen({ subjectId }: { subjectId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void openSubjectAction(subjectId);
  }, [subjectId]);
  return null;
}
