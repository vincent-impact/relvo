"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SwipeRow } from "@/components/shared/swipe-row";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  deleteSubjectAction,
  reopenSubjectAction,
} from "@/server/actions/subjects";

// Ligne swipable d'un sujet TERMINAL (onglets Validés / Fermés) — pendant de
// `SwipeableSubject`, qui ne sert qu'aux sujets ouverts :
//   → DROITE = Remettre (vert)      — repasse en `ouvert`, `closed_at` effacé
//   ← GAUCHE = Supprimer (rouge)    — destruction DÉFINITIVE, donc confirmée
//
// Pourquoi ce composant existe (2026-09-07) : les deux boutons du dock de la
// fiche Sujet ont été retirés (ils doublonnaient les swipes et déroutaient les
// bêta-testeurs). Sur un sujet terminal ils étaient pourtant le SEUL chemin de
// réouverture — sans ce swipe, un sujet validé aurait été enfermé pour de bon.
// Le geste précède donc le retrait : il ne le suit pas.
//
// ⚠️ Vocabulaire imposé (invariant n°7) : « Remettre », jamais « Réouvrir ».
// « Fermer » est une suppression DOUCE ; « Supprimer » est la seule destruction,
// et n'existe que sur un sujet déjà terminal.
//
// Pas de retrait optimiste : la ligne change de PANIER (Validés → Ouverts), pas
// de statut binaire. `router.refresh()` rejoue le rendu serveur, qui la reclasse
// — un `leaving` local mentirait sur l'onglet de destination.

export function SwipeableDoneSubject({
  subjectId,
  children,
}: {
  subjectId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function remettre() {
    startTransition(async () => {
      const res = await reopenSubjectAction(subjectId);
      if (res.ok) {
        toast.success("Sujet remis");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function del() {
    startTransition(async () => {
      const res = await deleteSubjectAction(subjectId);
      if (res.ok) {
        setConfirmDelete(false);
        toast.success("Sujet supprimé");
        router.refresh();
      } else {
        toast.error(res.message);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      <SwipeRow
        onTap={() => router.push(`/sujets/${subjectId}`)}
        left={{
          // `keepOnAct` : la ligne revient en place, la confirmation prend le
          // relais — on ne fait jamais disparaître ce qu'on n'a pas encore détruit.
          onAct: () => setConfirmDelete(true),
          label: "Supprimer",
          icon: Trash2,
          tone: "danger",
          keepOnAct: true,
        }}
        right={{
          onAct: remettre,
          label: "Remettre",
          icon: RotateCcw,
          tone: "success",
        }}
      >
        {children}
      </SwipeRow>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={Trash2}
        title="Supprimer ce sujet ?"
        description="Ses tâches et tout son journal seront définitivement effacés. Cette action est irréversible."
        confirmLabel="Supprimer"
        pending={pending}
        onConfirm={del}
      />
    </>
  );
}
