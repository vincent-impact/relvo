"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updateSubjectAction } from "@/server/actions/subjects";

// Onglet « Informations » de la fiche Sujet (2026-07-23) — le premier écran, pensé
// pour qu'en un coup d'œil l'utilisateur sache quoi entreprendre. Deux blocs :
//
//  • DESCRIPTIF (éditable) — rédigé par l'utilisateur, il aide Relvo à rattacher
//    le bon domaine et à chercher dans les bonnes conversations. Enregistré au
//    blur (optimiste, comme le renommage du titre).
//  • RAPPORT D'ACTIVITÉ de Relvo — « Indisponible » pour l'instant (placeholder
//    honnête : le rapport généré arrivera avec le pipeline IA).

export function InformationsPane({
  subjectId,
  description,
}: {
  subjectId: string;
  description: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(description ?? "");
  const [, startTransition] = useTransition();

  const base = (description ?? "").trim();

  function save() {
    const next = value.trim();
    if (next === base) return; // rien de neuf → aucune écriture
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, {
        description: next || null,
      });
      if (res.ok) {
        toast.success("Descriptif enregistré");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-2">
      {/* Descriptif éditable */}
      <section>
        <h2 className="text-[15px] font-bold text-(--text-primary)">
          Descriptif
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-[1.4] text-(--text-tertiary)">
          Aidez Relvo à rattacher le bon domaine et à chercher dans les bonnes
          conversations.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          rows={4}
          placeholder="Décrivez ce sujet en quelques mots…"
          className="mt-2.5 w-full resize-y rounded-xl border border-(--border) bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-(--text-primary) outline-none placeholder:text-(--text-tertiary) focus:border-brand"
        />
      </section>

      {/* Rapport d'activité de Relvo — placeholder */}
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-relvo">
          <Sparkles className="size-4" fill="currentColor" strokeWidth={0} />
          Rapport d'activité de Relvo
        </div>
        <div className="rounded-xl border border-(--border) bg-(--surface-2) px-3.5 py-4 text-center text-[13.5px] font-semibold text-(--text-tertiary)">
          Indisponible
        </div>
      </section>
    </div>
  );
}
