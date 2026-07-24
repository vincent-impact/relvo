"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SubjectStatus } from "@relvo/db";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  closeSubjectAction,
  deleteSubjectAction,
  reopenSubjectAction,
  validateSubjectAction,
} from "@/server/actions/subjects";

// Dock d'actions de la fiche Sujet (2026-07-24) — chrome violet (verre Relvo) en
// bas de l'onglet Informations. Le menu DÉPEND DU STATUT :
//   • ouvert  → Fermer / Valider  (mêmes gestes que les swipes ← / →)
//   • validé  → Supprimer (hard delete, confirmation) / Réouvrir
//   • fermé   → Supprimer (hard delete, confirmation) / Réouvrir
//
// « Fermer » est un SOFT delete (récupérable via Réouvrir) ; « Supprimer » est la
// SEULE destruction définitive, et n'existe donc que sur un sujet déjà terminal.

type ActionResult = { ok: true } | { ok: false; message: string };

export function SubjectInfoDock({
  subjectId,
  status,
}: {
  subjectId: string;
  status: SubjectStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(action: () => Promise<ActionResult>, msg: string) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(msg);
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
        toast.success("Sujet supprimé");
        router.push("/fil");
      } else {
        toast.error(res.message);
        setConfirmDelete(false);
      }
    });
  }

  const ghost =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/35 py-2.5 text-[13.5px] font-bold text-white active:bg-white/10 disabled:opacity-50";
  const primary =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13.5px] font-bold text-relvo active:opacity-90 disabled:opacity-50";

  return (
    <div
      className="z-30 px-4 pt-3"
      style={{
        paddingBottom: "max(calc(env(safe-area-inset-bottom) - 12px), 8px)",
        background:
          "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
        backdropFilter: "blur(28px) saturate(170%)",
        WebkitBackdropFilter: "blur(28px) saturate(170%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22)",
      }}
    >
      {status === "open" ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => closeSubjectAction(subjectId), "Sujet fermé")
            }
            className={ghost}
          >
            <X className="size-[16px]" strokeWidth={2.2} />
            Fermer
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => validateSubjectAction(subjectId), "Sujet validé")
            }
            className={primary}
          >
            <Check className="size-[17px]" strokeWidth={2.6} />
            Valider
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className={ghost}
          >
            <Trash2 className="size-[16px]" strokeWidth={2.1} />
            Supprimer
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => reopenSubjectAction(subjectId), "Sujet rouvert")
            }
            className={primary}
          >
            <RotateCcw className="size-[16px]" strokeWidth={2.4} />
            Réouvrir
          </button>
        </div>
      )}

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
    </div>
  );
}
