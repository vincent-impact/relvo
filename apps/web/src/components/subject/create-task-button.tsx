"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SKY_BTN } from "@/components/layout/relvo-header";
import { TaskModal } from "@/components/subject/task-modal";

// Bouton « + » posé sur le ciel du Calendrier → crée une tâche via la modale
// partagée, sujet OPTIONNEL (une tâche peut ne pas avoir de sujet).

export function CreateTaskButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nouvelle tâche"
        className={SKY_BTN}
      >
        <Plus className="size-[18px]" strokeWidth={2.4} />
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
