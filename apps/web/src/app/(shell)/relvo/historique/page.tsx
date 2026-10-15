import Link from "next/link";
import { Plus } from "lucide-react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { HistoriqueLocal } from "@/components/relvo-chat/historique-local";
import { requireAccount } from "@/server/auth-context";

// Historique des ÉCHANGES avec Relvo (M10.4). Ils sont éphémères, en
// IndexedDB sur l'appareil (05 §11.3) : la page serveur ne porte que l'entrée
// « Nouvel échange » ; la liste se lit côté client (`HistoriqueLocal`).
//
// « Échange » et non « conversation » : depuis M6bis, une Conversation est une
// ENTITÉ DE DONNÉES — le fil avec un interlocuteur externe. Garder le même mot
// pour les deux ferait dire à l'utilisateur « ouvre la conversation avec Karim »
// et « reprends ma conversation d'hier » pour deux choses sans rapport.

export default async function RelvoHistoryPage() {
  await requireAccount();

  return (
    <MobileFrame>
      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background">
        <RelvoHeader back="/relvo" title="Mes échanges avec Relvo" />

        <div className="pt-5">
          {/* Une action de l'utilisateur : carte blanche, jamais le violet pâle
              signé, réservé à la voix de Relvo (01-tokens). */}
          <Link
            href="/relvo?nouveau=1"
            className="mx-4 flex items-center gap-3 rounded-(--rayon-carte) border border-(--filet) bg-white px-3.5 py-3.5 shadow-carte active:bg-(--fond-enfonce)"
          >
            <span className="grid size-9 flex-none place-items-center rounded-full bg-relvo text-white">
              <Plus className="size-[18px]" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium text-noir">
                Nouvel échange
              </span>
              <span className="block text-[12px] font-normal text-gris">
                Demander à Relvo…
              </span>
            </span>
          </Link>

          <HistoriqueLocal />
        </div>
      </main>
    </MobileFrame>
  );
}
