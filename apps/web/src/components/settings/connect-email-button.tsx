"use client";

import { Envelope, WhatsappLogo } from "@/components/shared/picto";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MailProvider } from "@/server/unipile/client";
import { connectEmailChannelAction } from "@/server/actions/email";
import { connectWhatsAppChannelAction } from "@/server/actions/whatsapp";

// Relier une boîte — UN bouton primaire, et le choix technique (Gmail, Outlook,
// une autre boîte) vient APRÈS le « oui », dans une feuille, pas avant sous
// forme de quatre cases à égalité. WhatsApp en second, en puce blanche : le
// brief dit « sa première adresse e-mail ». L'avertissement sur la session
// WhatsApp vit dans sa feuille, pas sur la page.

/** Les trois boîtes qu'on sait relier — la même liste sur la dernière
 * diapositive de la première connexion (M19.9). */
export const MAIL_CHOICES: {
  provider: MailProvider;
  label: string;
  hint: string;
}[] = [
  { provider: "GOOGLE", label: "Gmail", hint: "Google Workspace compris" },
  { provider: "OUTLOOK", label: "Outlook", hint: "Microsoft 365 compris" },
  {
    provider: "MAIL",
    label: "Une autre boîte",
    hint: "OVH, Orange, Free, Gandi…",
  },
];

export function ConnectEmailButton({
  peutAjouterEmail = true,
  peutAjouterWhatsApp = true,
  boitesEmail = 0,
}: {
  /** Il reste de la place pour une boîte e-mail (dix par compte, M24). */
  peutAjouterEmail?: boolean;
  /** Aucun WhatsApp connecté → la ligne WhatsApp. */
  peutAjouterWhatsApp?: boolean;
  /** Les boîtes e-mail déjà reliées : le bouton dit « une autre » dès la deuxième. */
  boitesEmail?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<MailProvider | "WHATSAPP" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"email" | "whatsapp" | null>(null);

  function connect(provider: MailProvider) {
    setError(null);
    setBusy(provider);
    startTransition(async () => {
      const result = await connectEmailChannelAction(provider);
      if (result.ok) {
        window.location.href = result.data.url;
        return;
      }
      setSheet(null);
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
      setSheet(null);
      setError(result.message);
      setBusy(null);
    });
  }

  if (!peutAjouterEmail && !peutAjouterWhatsApp) return null;

  return (
    <div className="mt-3 space-y-2">
      {peutAjouterEmail ? (
        <button
          type="button"
          onClick={() => setSheet("email")}
          disabled={pending}
          className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-(--rayon-pilule) text-[15px] font-medium text-white disabled:opacity-60"
          style={{ background: "var(--degrade-relvo)" }}
        >
          <Envelope className="size-[18px]" />
          {boitesEmail > 0
            ? "Relier une autre boîte e-mail"
            : "Connecter ma boîte e-mail"}
        </button>
      ) : null}
      {peutAjouterWhatsApp ? (
        <button
          type="button"
          onClick={() => setSheet("whatsapp")}
          disabled={pending}
          className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-(--rayon-pilule) border border-(--filet) bg-white text-[15px] font-medium text-noir shadow-carte disabled:opacity-60"
        >
          <WhatsappLogo className="size-[18px]" />
          Ajouter WhatsApp
        </button>
      ) : null}
      {error ? (
        <p className="px-1 text-[12px] font-normal text-urgent">{error}</p>
      ) : null}

      <Dialog
        open={sheet === "email"}
        onOpenChange={(o) => !o && !pending && setSheet(null)}
      >
        <DialogContent className="gap-3 p-5">
          <DialogHeader>
            <DialogTitle>Quelle boîte e-mail ?</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-(--rayon-carte) border border-(--filet)">
            {MAIL_CHOICES.map((c) => (
              <button
                key={c.provider}
                type="button"
                onClick={() => connect(c.provider)}
                disabled={pending}
                className="flex h-13 w-full items-center gap-3 border-b border-(--filet) px-3.5 text-left last:border-b-0 active:bg-(--fond-enfonce) disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-normal text-noir">
                    {busy === c.provider ? "Ouverture…" : c.label}
                  </span>
                  <span className="block text-[12px] font-normal text-gris">
                    {c.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[12px] font-normal text-gris">
            Relvo lit les nouveaux e-mails et répond depuis votre adresse.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sheet === "whatsapp"}
        onOpenChange={(o) => !o && !pending && setSheet(null)}
      >
        <DialogContent className="gap-3 p-5">
          <DialogHeader>
            <DialogTitle>Ajouter WhatsApp</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] leading-5 font-light text-noir">
            Vous scannerez un QR code depuis l’app WhatsApp de votre téléphone.
          </p>
          <p className="text-[12px] leading-4 font-normal text-gris">
            La connexion passe par une session non officielle : un usage
            intensif peut entraîner un blocage du numéro par WhatsApp — rare
            pour un volume normal, mais à connaître.
          </p>
          <button
            type="button"
            onClick={connectWhatsApp}
            disabled={pending}
            className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-(--rayon-pilule) text-[15px] font-medium text-white disabled:opacity-60"
            style={{ background: "var(--degrade-relvo)" }}
          >
            {busy === "WHATSAPP" ? "Ouverture…" : "Scanner le QR code"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
