"use client";

import { usePathname } from "next/navigation";
import { RelvoLogoButton } from "@/components/layout/relvo-logo-button";

// Accès à Relvo — bouton logo posé en HAUT À DROITE de chaque header violet
// (remplace l'ancien composer persistant du bas). Même forme que le bouton ✦ qui
// vivait dans le composer. Page-aware (invariant 26) : il ouvre une nouvelle
// conversation plein écran en transmettant la page d'origine via `?from=`, pour
// le chip de contexte, les prompts et le bouton retour de la conversation.

export function RelvoHeaderButton({ size = 42 }: { size?: number }) {
  const pathname = usePathname();
  const href = `/conversation?from=${encodeURIComponent(pathname)}`;
  return <RelvoLogoButton size={size} href={href} label="Demander à Relvo" />;
}
