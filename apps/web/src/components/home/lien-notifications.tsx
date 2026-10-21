"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RELVO_LINK } from "@/components/shared/relvo-block";
import { doitReproposer } from "@/lib/push-client";
import {
  activerPushAppareil,
  etatPushAppareil,
  lirePlusTard,
} from "@/lib/push-appareil";

// La ligne « → Activer les notifications » du bloc des nouvelles : tant que
// CET appareil n'est pas abonné et que l'invitation n'a pas été remise à plus
// tard, l'accueil la propose en un geste — c'est là qu'on revient chaque
// matin. Rien quand le push est impossible ou refusé ici : une ligne qui ne
// mène nulle part est une ligne en trop.

export function LienNotifications({
  clePublique,
}: {
  clePublique: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let vivant = true;
    if (!doitReproposer(lirePlusTard())) return;
    etatPushAppareil(clePublique).then((e) => {
      if (vivant) setVisible(e.kind === "pret" && !e.actif);
    });
    return () => {
      vivant = false;
    };
  }, [clePublique]);

  if (!visible || !clePublique) return null;

  function activer() {
    start(async () => {
      const r = await activerPushAppareil(clePublique!);
      if (r.ok) {
        setVisible(false);
        toast.success("C’est activé. Une notification de bienvenue arrive.");
      } else if (r.raison === "refuse") {
        setVisible(false);
        toast.error(
          "Les notifications sont bloquées pour Relvo dans les réglages du téléphone.",
        );
      } else if (r.raison === "erreur") {
        toast.error("Je n’ai pas pu activer les notifications. Réessayez.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={activer}
      disabled={pending}
      className={`${RELVO_LINK} w-full text-left disabled:opacity-60`}
    >
      → {pending ? "Activation…" : "Activer les notifications sur cet appareil"}
    </button>
  );
}
