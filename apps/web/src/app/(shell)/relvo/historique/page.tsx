import Link from "next/link";
import { Plus } from "lucide-react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { requireAccount } from "@/server/auth-context";

// Historique des ÉCHANGES avec Relvo (coquille M9, Direction B). Ils sont
// éphémères en IndexedDB côté client (M10) : en V1 on n'affiche que l'entrée
// « Nouvel échange » mise en avant et un empty-state honnête.
//
// « Échange » et non « conversation » : depuis M6bis, une Conversation est une
// ENTITÉ DE DONNÉES — le fil avec un interlocuteur externe. Garder le même mot
// pour les deux ferait dire à l'utilisateur « ouvre la conversation avec Karim »
// et « reprends ma conversation d'hier » pour deux choses sans rapport.

export default async function RelvoHistoryPage() {
  await requireAccount();

  return (
    <MobileFrame>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        <RelvoHeader back="/" title="Mes échanges avec Relvo" relvo={false} />

        <div className="px-4 pt-5">
          <Link
            href="/relvo"
            className="flex items-center gap-3 rounded-2xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3.5"
          >
            <span className="grid size-9 flex-none place-items-center rounded-full bg-relvo text-white">
              <Plus className="size-[18px]" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[14.5px] font-bold text-brand-dark">
                Nouvel échange
              </span>
              <span className="block text-[12px] text-relvo">
                Demander à Relvo…
              </span>
            </span>
          </Link>

          <div className="mt-7 mb-2 px-1 text-[12px] font-bold tracking-[0.5px] text-(--text-tertiary) uppercase">
            Récentes
          </div>
          <p className="px-1 text-[13.5px] text-(--text-tertiary)">
            Vos échanges récents avec Relvo apparaîtront ici.
          </p>
        </div>
      </main>
    </MobileFrame>
  );
}
