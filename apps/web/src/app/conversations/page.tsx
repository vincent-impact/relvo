import Link from "next/link";
import { Plus } from "lucide-react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { requireAccount } from "@/server/auth-context";

// Historique des conversations (coquille M9, Direction B). Les conversations
// sont éphémères en IndexedDB côté client (M10) : en V1 on n'affiche que l'entrée
// « Nouvelle conversation » mise en avant et un empty-state honnête.

export default async function ConversationsPage() {
  await requireAccount();

  return (
    <MobileFrame>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        <RelvoHeader back="/" title="Mes conversations" />

        <div className="px-4 pt-5">
          <Link
            href="/conversation"
            className="flex items-center gap-3 rounded-2xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3.5"
          >
            <span className="grid size-9 flex-none place-items-center rounded-full bg-relvo text-white">
              <Plus className="size-[18px]" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[14.5px] font-bold text-brand-dark">
                Nouvelle conversation
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
            Vos conversations récentes apparaîtront ici.
          </p>
        </div>
      </main>
    </MobileFrame>
  );
}
