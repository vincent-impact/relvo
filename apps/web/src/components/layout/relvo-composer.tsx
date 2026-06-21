"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Mic } from "lucide-react";

// Composer Relvo persistant (cf. ux-mobile-first §6.0). Présent sur toutes les
// vues structurées, ancré au-dessus de la barre d'onglets.
//  - ✦ = accès à l'historique des conversations (/conversations)
//  - champ = ouvre une nouvelle conversation plein écran avec le contexte de page
//  - 📷 / 🎙 = entrées photo / vocal (coquille en V1, branchées en M10)
// Aucun appel IA en M9 : c'est la coquille navigable validée avec l'utilisateur.

export function RelvoComposer() {
  const pathname = usePathname();
  const href = `/conversation?from=${encodeURIComponent(pathname)}`;

  return (
    <div
      className="flex flex-none items-center gap-2.5 border-t border-(--hairline) bg-white px-3 py-2.5"
      style={{ boxShadow: "var(--shadow-up)" }}
    >
      <Link
        href="/conversations"
        aria-label="Mes conversations"
        className="grid size-[38px] flex-none place-items-center rounded-full bg-relvo text-[17px] text-white active:scale-95"
      >
        ✦
      </Link>
      <Link
        href={href}
        className="flex flex-1 items-center rounded-full border border-(--hairline) bg-(--surface) px-3.5 py-2.5 text-sm text-(--text-tertiary)"
      >
        Demander à Relvo…
      </Link>
      <button
        type="button"
        aria-label="Prendre une photo"
        className="grid size-[38px] flex-none place-items-center rounded-full border border-(--hairline) bg-(--surface) text-(--text-secondary)"
      >
        <Camera className="size-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Dicter"
        className="grid size-[42px] flex-none place-items-center rounded-full bg-relvo text-white shadow-[0_2px_8px_rgba(107,91,214,0.35)] active:scale-95"
      >
        <Mic className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}
