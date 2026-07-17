"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchissement périodique des Server Components (M12.3, en attendant le
// temps réel). En V1 il n'y a pas de WebSocket : un message qui arrive par
// webhook (email/WhatsApp) n'est pas poussé au navigateur. De plus le Router
// Cache de Next réutilise le payload d'une route déjà visitée pendant
// `staleTimes.dynamic` (30 s) → une navigation « retour » peut resservir un état
// périmé. `router.refresh()` force un re-fetch serveur (frais), en contournant
// ce cache. On ne rafraîchit que si l'onglet est VISIBLE (pas de requêtes en
// arrière-plan), et aussi au retour d'onglet.

export function PollRefresh({ intervalMs = 12_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(refreshIfVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, intervalMs]);
  return null;
}
