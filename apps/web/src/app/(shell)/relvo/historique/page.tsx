import Link from "next/link";
import { Plus } from "lucide-react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { ZoneHeading } from "@/components/shared/zone-heading";
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
      <main className="min-h-0 flex-1 overflow-y-auto bg-background">
        <RelvoHeader back="/relvo" title="Mes échanges avec Relvo" />

        <div className="pt-5">
          {/* Une action de l'utilisateur : carte blanche, jamais le violet pâle
              signé, réservé à la voix de Relvo (01-tokens). */}
          <Link
            href="/relvo"
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

          <div className="mt-7">
            <ZoneHeading label="Récentes" />
            <p className="px-4 text-[14px] font-light text-gris">
              Vos échanges récents avec Relvo apparaîtront ici.
            </p>
          </div>
        </div>
      </main>
    </MobileFrame>
  );
}
