"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaskModal } from "@/components/subject/task-modal";

// Bouton « + » du header de l'Accueil (« Actions ») → crée une tâche via la
// modale partagée, sujet OPTIONNEL (une tâche peut ne pas avoir de sujet).

export function CreateTaskButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nouvelle tâche"
        className="grid size-[42px] flex-none place-items-center rounded-full text-white active:scale-95"
        style={{
          background: "rgb(255 255 255 / 0.15)",
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
        }}
      >
        <Plus className="size-[22px]" strokeWidth={2.2} />
      </button>

      {open ? (
        <TaskModal
          open
          onOpenChange={setOpen}
          mode="create"
          initial={{ subjectId: null, subjectTitle: null }}
        />
      ) : null}
    </>
  );
}
