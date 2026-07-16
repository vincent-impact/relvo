"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { connectEmailChannelAction } from "@/server/actions/email";

// M5.7 — démarre la connexion d'une boîte email via le hosted auth Unipile.
// La Server Action pré-crée le canal puis renvoie l'URL du wizard hébergé ;
// on redirige le navigateur dessus (Unipile gère tout l'OAuth/IMAP). Au retour,
// le webhook `notify` finalise la connexion et l'onglet reflète le statut.

export function ConnectEmailButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    startTransition(async () => {
      const result = await connectEmailChannelAction();
      if (result.ok) {
        window.location.href = result.data.url;
        return;
      }
      setError(result.message);
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-(--border) py-3.5 text-[13.5px] font-semibold text-(--text-secondary) disabled:opacity-60"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        {pending ? "Ouverture…" : "Connecter une boîte email"}
      </button>
      {error ? (
        <p className="mt-2 px-1 text-[12px] text-(--red-600)">{error}</p>
      ) : (
        <p className="mt-3 px-1 text-[12px] text-(--text-tertiary)">
          Connectez Gmail, Outlook ou toute boîte IMAP (OVH, Orange…). Relvo lit
          les nouveaux emails et répond depuis votre adresse. WhatsApp arrive
          avec le module suivant.
        </p>
      )}
    </div>
  );
}
