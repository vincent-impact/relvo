"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, RefreshCw, Send, Sparkles, X } from "lucide-react";

// RecipientComposer — le composer signature de la Direction B, VIOLET (cohérence
// avec le chrome de l'app ; Relvo n'est plus un destinataire ici, il vit dans le
// bouton du header). Micro quand vide (voice-first), avion dès qu'on tape. 📎 dans
// le champ. `onSend` est optionnel (coquille sans envoi réel).
//
// ⚠️ 2026-07-23 — le SÉLECTEUR d'interlocuteur (avatar + menu) a été RETIRÉ : les
// conversations sont NOMINATIVES, la conversation courante est déjà choisie par
// le sélecteur de conversation en tête de l'onglet. Le composer répond donc
// simplement à la conversation active (`value`), sans bouton ni menu propre.

/** Le brouillon de Relvo dans le composer (M7.7) : en rédaction, puis posé dans le champ. */
export type ComposerDraft = {
  /** Relvo rédige : le champ attend. */
  loading: boolean;
  /** Le texte à poser dans le champ quand il arrive (une fois par valeur). */
  text: string | null;
  onRegenerate?: () => void;
  onClear?: () => void;
};

export type Recipient = {
  key: string;
  name: string;
  kind: "human" | "relvo" | "all";
  initials?: string;
  sublabel?: string;
};

export function RecipientComposer({
  recipients = [{ key: "relvo", name: "Relvo", kind: "relvo" }],
  defaultRecipient,
  value,
  placeholder,
  defaultValue = "",
  attach = true,
  onSend,
  draft,
}: {
  recipients?: Recipient[];
  defaultRecipient?: string;
  /** Conversation active (synchronisée avec le sélecteur de conversation). */
  value?: string;
  placeholder?: string;
  defaultValue?: string;
  attach?: boolean;
  /** Retourner `false` (ou une promesse de `false`) préserve le texte saisi. */
  onSend?: (
    text: string,
    recipientKey: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Brouillon de Relvo (M7.7) — jamais envoyé seul : il se pose dans le champ, l'utilisateur envoie. */
  draft?: ComposerDraft | null;
}) {
  const cur = value ?? defaultRecipient ?? recipients[0]?.key ?? "relvo";
  const [text, setText] = useState(defaultValue);
  // Le brouillon se pose dans le champ à son arrivée, une seule fois par
  // texte : l'utilisateur reste libre de le retoucher ensuite.
  const [posed, setPosed] = useState<string | null>(null);
  const draftText = draft?.text ?? null;
  if (draftText !== null && draftText !== posed) {
    setPosed(draftText);
    setText(draftText);
  }
  const showDraftBar = Boolean(draft && (draft.loading || draftText !== null));
  const r = recipients.find((x) => x.key === cur) || recipients[0];
  const typing = text.trim().length > 0;

  // Nom du destinataire tronqué pour tenir le placeholder sur UNE ligne.
  const recipientLabel =
    r && r.name.length > 16 ? `${r.name.slice(0, 15).trimEnd()}…` : r?.name;
  const ph =
    placeholder ||
    (r?.kind === "relvo"
      ? "Demander à Relvo…"
      : r?.kind === "all"
        ? "Répondre à tous…"
        : `Répondre à ${recipientLabel ?? ""}${recipientLabel?.endsWith("…") ? "" : "…"}`);

  // Textarea auto-croissante : un email fait plusieurs lignes, on agrandit le
  // champ jusqu'à un plafond (puis scroll interne) plutôt qu'une ligne unique.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!typing || sending) return;
    if (!onSend) {
      setText("");
      return;
    }
    setSending(true);
    try {
      const result = await onSend(text, cur);
      // On ne vide le champ que si l'envoi n'a pas explicitement échoué.
      if (result !== false) {
        setText("");
        setPosed(null);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="relative flex flex-col gap-2 px-3.5 pt-[11px]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        background:
          "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
        backdropFilter: "blur(28px) saturate(170%)",
        WebkitBackdropFilter: "blur(28px) saturate(170%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.34)",
      }}
    >
      {/* Brouillon de Relvo (M7.7) — étiqueté comme une suggestion modifiable,
          régénérable, effaçable ; jamais envoyé seul (05 §3.1). */}
      {showDraftBar ? (
        <div className="flex items-center gap-2 px-1 text-[12.5px] font-semibold text-white/90">
          <Sparkles
            className="size-3.5 flex-none"
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="min-w-0 flex-1 truncate">
            {draft?.loading
              ? "Relvo rédige votre réponse…"
              : "Brouillon de Relvo — modifiez librement avant d'envoyer"}
          </span>
          {!draft?.loading && draft?.onRegenerate ? (
            <button
              type="button"
              onClick={draft.onRegenerate}
              aria-label="Régénérer le brouillon"
              className="grid size-7 flex-none place-items-center rounded-full text-white/85 active:bg-white/15"
            >
              <RefreshCw className="size-[15px]" strokeWidth={2.2} />
            </button>
          ) : null}
          {!draft?.loading && draft?.onClear ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                draft.onClear?.();
              }}
              aria-label="Effacer le brouillon"
              className="grid size-7 flex-none place-items-center rounded-full text-white/85 active:bg-white/15"
            >
              <X className="size-[16px]" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <div
          className="flex min-w-0 flex-1 items-end gap-[7px] rounded-[22px] py-[5px] pr-1.5 pl-[15px]"
          style={{
            background: "rgb(255 255 255 / 0.06)",
            border: "1px solid rgb(255 255 255 / 0.28)",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.04)",
          }}
        >
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Email multi-ligne : Entrée = saut de ligne ; ⌘/Ctrl+Entrée = envoi.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ph}
            className="max-h-[168px] min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-[14.5px] leading-[1.4] text-white outline-none placeholder:text-white/70"
          />
          {/* Trombone à DROITE du champ (toujours visible). */}
          {attach ? (
            <button
              type="button"
              aria-label="Joindre un fichier"
              className="grid flex-none place-items-center py-1.5 text-white/85"
            >
              <Paperclip className="size-5" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending || Boolean(draft?.loading)}
          aria-label={typing ? "Envoyer" : "Dicter"}
          className="grid size-[42px] flex-none place-items-center rounded-full bg-white text-relvo active:scale-95 disabled:opacity-70"
          style={{ boxShadow: "0 5px 16px rgb(0 0 0 / 0.22)" }}
        >
          {typing ? (
            <Send className="size-[19px]" strokeWidth={2} />
          ) : (
            <Mic className="size-5" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
