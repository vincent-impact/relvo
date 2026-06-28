"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaskModal } from "@/components/subject/task-modal";

// Ajout de tâche (onglet Tâches de la fiche Sujet) — « + Ajouter une tâche »
// ouvre la MODALE PARTAGÉE (task-modal) en mode création, sujet pré-rempli sur la
// fiche courante (réassignable/détachable depuis la modale comme partout).

export function AddTask({
  subjectId,
  subjectTitle,
}: {
  subjectId: string;
  subjectTitle: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-[14px] mt-1 flex items-center gap-2.5 px-[18px] py-3.5 text-[14px] font-bold text-relvo"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-bg">
          <Plus className="size-[15px]" strokeWidth={2.6} />
        </span>
        Ajouter une tâche
      </button>

      {open ? (
        <TaskModal
          open
          onOpenChange={setOpen}
          mode="create"
          initial={{ subjectId, subjectTitle }}
        />
      ) : null}
    </>
  );
}
