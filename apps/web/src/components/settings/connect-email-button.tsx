"use client";

import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import type { MailProvider } from "@/server/unipile/client";
import { connectEmailChannelAction } from "@/server/actions/email";

// M5.7 — connexion d'une boîte email via le hosted auth Unipile. On fait choisir
// le TYPE de boîte ici (Gmail / Outlook / IMAP) et on ne passe qu'un provider à
// Unipile → son écran de sélection est sauté (parcours plus direct).

const CHOICES: { provider: MailProvider; label: string }[] = [
  { provider: "GOOGLE", label: "Gmail" },
  { provider: "OUTLOOK", label: "Outlook" },
  { provider: "MAIL", label: "Autre (IMAP)" },
];

export function ConnectEmailButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<MailProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  function connect(provider: MailProvider) {
    setError(null);
    setBusy(provider);
    startTransition(async () => {
      const result = await connectEmailChannelAction(provider);
      if (result.ok) {
        window.location.href = result.data.url;
        return;
      }
      setError(result.message);
      setBusy(null);
    });
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.provider}
            type="button"
            onClick={() => connect(c.provider)}
            disabled={pending}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-(--border) py-4 text-[12.5px] font-semibold text-(--text-secondary) disabled:opacity-60"
          >
            <Mail className="size-[18px]" strokeWidth={2} />
            {busy === c.provider ? "Ouverture…" : c.label}
          </button>
        ))}
      </div>
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
