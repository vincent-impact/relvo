"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import { RelvoLogoButton } from "@/components/layout/relvo-logo-button";

// Composer Relvo persistant (cf. ux-mobile-first §6.0) — barre violette « Liquid
// Glass » qui ferme le bas de chaque écran à onglets (cadre violet-haut /
// violet-bas de la Direction B). Ancré sous la tab bar givrée, dans le dock.
//  - ✦ = accès à l'historique des conversations (/conversations)
//  - champ = ouvre une nouvelle conversation plein écran avec le contexte de page
//  - 🎙 = entrée vocale (voice-first ; coquille en V1, branchée en M10)
// Aucun appel IA en M9 : c'est la coquille navigable validée avec l'utilisateur.

export function RelvoComposer() {
  const pathname = usePathname();
  const href = `/conversation?from=${encodeURIComponent(pathname)}`;

  return (
    <div
      className="relative flex items-center gap-2.5 px-3.5 pt-2.5"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        background:
          "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
        backdropFilter: "blur(28px) saturate(170%)",
        WebkitBackdropFilter: "blur(28px) saturate(170%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.34)",
      }}
    >
      <RelvoLogoButton size={42} />
      <Link
        href={href}
        className="flex flex-1 items-center rounded-full px-[17px] py-3 text-[15px]"
        style={{
          background: "rgb(255 255 255 / 0.06)",
          border: "1px solid rgb(255 255 255 / 0.28)",
          color: "rgb(255 255 255 / 0.9)",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.04)",
        }}
      >
        Demander à Relvo…
      </Link>
      <Link
        href={href}
        aria-label="Dicter à Relvo"
        className="grid size-[45px] flex-none place-items-center rounded-full bg-white text-relvo active:scale-95"
        style={{ boxShadow: "0 5px 16px rgb(0 0 0 / 0.22)" }}
      >
        <Mic className="size-5" strokeWidth={2} />
      </Link>
    </div>
  );
}
