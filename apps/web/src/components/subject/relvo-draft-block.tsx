"use client";

import { Sparkles } from "lucide-react";
import { toast } from "sonner";

// Bloc d'action « Brouillon préparé par Relvo » (onglet Messages de la fiche,
// cf. .action-block du DS) : carte blanche à liseré violet portant le brouillon
// de réponse, avec Envoyer / Modifier. Invariant n°9 : le brouillon n'est jamais
// envoyé automatiquement. En M9 (coquille, pas d'IA branchée), les actions sont
// des amorces — l'envoi réel arrive avec les canaux (M5/M6) et le chat (M10).

export function RelvoDraftBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-l-[3px] border-(--purple-100) border-l-(--relvo) bg-white p-3.5">
      <div className="flex items-center gap-[7px] text-[12.5px] font-bold text-relvo">
        <Sparkles className="size-3.5" fill="currentColor" strokeWidth={0} />
        Brouillon préparé par Relvo
      </div>
      <p className="my-[7px] mb-[11px] text-[13.5px] leading-[1.45] text-[#3a3550]">
        « {text} »
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toast.info("L'envoi arrive avec les canaux (M5/M6).")}
          className="rounded-full bg-relvo px-[15px] py-[9px] text-[13px] font-bold text-white"
        >
          Envoyer
        </button>
        <button
          type="button"
          onClick={() =>
            toast.info("L'édition du brouillon arrive avec le chat (M10).")
          }
          className="rounded-full border border-(--border) bg-(--surface) px-[15px] py-[9px] text-[13px] font-bold text-(--text-secondary)"
        >
          Modifier
        </button>
      </div>
    </div>
  );
}
