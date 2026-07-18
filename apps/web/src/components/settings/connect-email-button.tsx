"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type { MailProvider } from "@/server/unipile/client";
import { connectEmailChannelAction } from "@/server/actions/email";
import { connectWhatsAppChannelAction } from "@/server/actions/whatsapp";

// M5.7 / M6.3 — connexion d'un canal via le hosted auth Unipile. Email : on fait
// choisir le TYPE de boîte (Gmail / Outlook / IMAP) → un seul provider passé à
// Unipile, son écran de sélection est sauté. WhatsApp : hosted auth QR code.

const CHOICES: { provider: MailProvider; label: string }[] = [
  { provider: "GOOGLE", label: "Gmail" },
  { provider: "OUTLOOK", label: "Outlook" },
  { provider: "MAIL", label: "Autre (IMAP)" },
];

export function ConnectEmailButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<MailProvider | "WHATSAPP" | null>(null);
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

  function connectWhatsApp() {
    setError(null);
    setBusy("WHATSAPP");
    startTransition(async () => {
      const result = await connectWhatsAppChannelAction();
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
      <div className="grid grid-cols-2 gap-2">
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
        {/* WhatsApp (M6.3) : hosted auth QR code Unipile. */}
        <button
          type="button"
          onClick={connectWhatsApp}
          disabled={pending}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-(--border) py-4 text-[12.5px] font-semibold text-(--text-secondary) disabled:opacity-60"
        >
          <MessageCircle className="size-[18px]" strokeWidth={2} />
          {busy === "WHATSAPP" ? "Ouverture…" : "WhatsApp"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 px-1 text-[12px] text-(--red-600)">{error}</p>
      ) : (
        <p className="mt-3 px-1 text-[12px] text-(--text-tertiary)">
          Connectez Gmail, Outlook ou toute boîte IMAP (OVH, Orange…). Relvo lit
          les nouveaux emails et répond depuis votre adresse. Pour WhatsApp,
          scannez un QR code depuis l’app WhatsApp de votre téléphone.
        </p>
      )}
      <p className="mt-2 px-1 text-[11.5px] leading-snug text-(--text-tertiary)">
        WhatsApp : la connexion passe par une session non officielle. Un usage
        intensif peut entraîner un blocage du numéro par WhatsApp (rare pour un
        volume normal, mais à connaître).
      </p>
    </div>
  );
}
