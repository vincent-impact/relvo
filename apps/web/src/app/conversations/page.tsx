import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { requireAccount } from "@/server/auth-context";

// Historique des conversations (coquille M9). Les conversations sont éphémères
// en IndexedDB côté client (M10) : en V1 on n'affiche que l'entrée « nouvelle
// conversation » et un empty-state honnête.

export default async function ConversationsPage() {
  await requireAccount();

  return (
    <MobileFrame>
      <header className="flex flex-none items-center gap-2.5 border-b border-(--border-light) bg-white px-4 py-2.5">
        <Link
          href="/"
          aria-label="Retour"
          className="-ml-1 grid size-8 flex-none place-items-center text-(--text-secondary)"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <div className="text-[18px] font-bold tracking-[-0.2px]">
          Mes conversations
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-(--surface) px-4 py-4">
        <Link
          href="/conversation"
          className="flex items-center gap-2.5 rounded-xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3"
        >
          <span className="grid size-8 flex-none place-items-center rounded-full bg-relvo text-lg text-white">
            <Plus className="size-4" strokeWidth={2.5} />
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

        <p className="mt-8 text-center text-[13.5px] text-(--text-tertiary)">
          Tes conversations récentes apparaîtront ici.
        </p>
      </main>
    </MobileFrame>
  );
}
