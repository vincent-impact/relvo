"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  ignoreSubjectAction,
  resolveSubjectAction,
} from "@/server/actions/subjects";
import { cn } from "@/lib/utils";

// Barre d'actions FIXE de la fiche Sujet (au-dessus de la barre d'onglets).
// Ignorer (gauche, rouge) · Terminer (droite, vert). Après succès → retour au fil.

export function SubjectActionBar({
  subjectId,
  canIgnore,
}: {
  subjectId: string;
  canIgnore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(okMsg);
        router.push("/fil");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div
      className="flex flex-none gap-2.5 border-t border-(--hairline) bg-white px-3 py-[7px]"
      style={{ boxShadow: "var(--shadow-up)" }}
    >
      {canIgnore ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => ignoreSubjectAction(subjectId), "Sujet ignoré")
          }
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--red-50) px-3 py-2 text-[13.5px] font-semibold text-(--red-600)",
            pending && "opacity-60",
          )}
        >
          <EyeOff className="size-4" strokeWidth={2} />
          Ignorer
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => resolveSubjectAction(subjectId), "Sujet terminé")
        }
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--green-50) px-3 py-2 text-[13.5px] font-semibold text-(--green-600)",
          pending && "opacity-60",
        )}
      >
        <Check className="size-4" strokeWidth={2} />
        Terminer
      </button>
    </div>
  );
}
