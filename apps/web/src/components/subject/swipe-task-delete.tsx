"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTaskAction } from "@/server/actions/tasks";
import { SwipeToRemove } from "@/components/shared/swipe-to-remove";

// Swipe-left « Supprimer » sur une tâche (onglet Tâches de la fiche Sujet). On ne
// peut pas éditer une tâche (V1) mais on peut la supprimer d'un glissé — décharge
// l'UI d'un bouton. La suppression est DÉFINITIVE (vrai DELETE côté domaine) ;
// on rafraîchit la fiche pour refléter le retrait.

export function SwipeTaskDelete({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (res.ok) {
        toast.success("Tâche supprimée");
        router.refresh();
      } else {
        toast.error(res.message);
        router.refresh(); // rollback visuel : la ligne réapparaît
      }
    });
  }

  return (
    <SwipeToRemove label="Supprimer" icon={Trash2} onRemove={remove}>
      {children}
    </SwipeToRemove>
  );
}
