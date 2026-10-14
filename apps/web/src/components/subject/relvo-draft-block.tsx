"use client";

import { Sparkle } from "@/components/shared/picto";
import { toast } from "sonner";

// Bloc d'action « Brouillon préparé par Relvo » (onglet Messages de la fiche) :
// un BLOC DE RELVO — violet pâle signé, jamais un liseré (01-tokens, « un bloc
// violet pâle signé des étoiles, c'est Relvo qui parle ») — portant le
// brouillon de réponse, avec Envoyer / Modifier. Invariant n°9 : le brouillon n'est jamais
// envoyé automatiquement. En M9 (coquille, pas d'IA branchée), les actions sont
// des amorces — l'envoi réel arrive avec les canaux (M5/M6) et le chat (M10).

export function RelvoDraftBlock({ text }: { text: string }) {
  return (
    <div className="rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale p-3.5 shadow-carte">
      <div className="flex items-center gap-[7px] text-[12.5px] font-medium text-relvo">
        <Sparkle className="size-3.5" />
        Brouillon préparé par Relvo
      </div>
      <p className="my-[7px] mb-[11px] text-[14px] leading-5 font-light text-noir">
        « {text} »
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toast.info("L'envoi arrive avec les canaux (M5/M6).")}
          className="pressable rounded-(--rayon-pilule) px-4 py-[9px] text-[13px] font-medium text-white"
          style={{ background: "var(--degrade-relvo)" }}
        >
          Envoyer
        </button>
        <button
          type="button"
          onClick={() =>
            toast.info("L'édition du brouillon arrive avec le chat (M10).")
          }
          className="pressable rounded-(--rayon-pilule) border border-(--filet) bg-white px-4 py-[9px] text-[13px] font-medium text-gris"
        >
          Modifier
        </button>
      </div>
    </div>
  );
}
