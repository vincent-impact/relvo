"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reopenSubjectAction } from "@/server/actions/subjects";
import { cn } from "@/lib/utils";

// Ligne d'un sujet FERMÉ (onglet Fermés du fil). Le sujet reste consultable
// (la ligne ouvre la fiche), et un bouton « Remettre dans le fil » rouvre sa
// fenêtre de travail (→ open) : filet de sécurité si Relvo a mal classé ou si
// l'utilisateur change d'avis. Retrait optimiste de la liste au succès.

export function ClosedSubject({
  subjectId,
  children,
}: {
  subjectId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);

  function reopen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLeaving(true);
    startTransition(async () => {
      const res = await reopenSubjectAction(subjectId);
      if (res.ok) {
        toast.success("Sujet remis dans le fil");
        router.refresh();
      } else {
        toast.error(res.message);
        setLeaving(false);
      }
    });
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        leaving ? "max-h-0 opacity-0" : "max-h-[600px]",
      )}
    >
      {children}
      <button
        type="button"
        onClick={reopen}
        className="absolute top-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-(--border) bg-white px-3 py-1.5 text-[12px] font-bold text-(--text-secondary) shadow-(--shadow-card) active:scale-95"
      >
        <RotateCcw className="size-3.5" strokeWidth={2.4} />
        Remettre
      </button>
    </div>
  );
}
