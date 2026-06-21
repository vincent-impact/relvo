"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { completeTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Case à cocher d'une tâche (onglet Tâches). Cocher = completeTaskAction. La
// couche domaine ne gère que la complétion (pas le décochage) → une tâche faite
// reste affichée cochée, statique.

export function TaskCheckbox({
  taskId,
  done,
}: {
  taskId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span className="mt-px grid size-[22px] flex-none place-items-center rounded-md border-2 border-(--green-600) bg-(--green-600) text-white">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label="Marquer la tâche comme faite"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await completeTaskAction(taskId);
          if (res.ok) toast.success("Tâche faite");
          else toast.error(res.message);
        })
      }
      className={cn(
        "mt-px grid size-[22px] flex-none place-items-center rounded-md border-2 border-(--border) text-transparent transition-colors hover:border-(--green-600)",
        pending && "opacity-60",
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </button>
  );
}
