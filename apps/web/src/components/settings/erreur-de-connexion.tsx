"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Le retour d'une connexion en échec (M24.2) : la page dit le motif une fois,
// en toast, et retire le paramètre de l'adresse — un rafraîchissement ne le
// redit pas. Le texte est celui de la frontière, le même pour tous.

export function ErreurDeConnexion({ message }: { message: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (!message) return;
    toast.error(message);
    const reste = new URLSearchParams(params.toString());
    reste.delete("erreur");
    const q = reste.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [message, params, pathname, router]);
  return null;
}
