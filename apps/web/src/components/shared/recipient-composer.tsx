"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

// RecipientComposer — le composer signature de la Direction B, VIOLET (cohérence
// avec le chrome de l'app ; Relvo n'est plus un destinataire ici, il vit dans le
// bouton du header). Micro quand vide (voice-first), avion dès qu'on tape. 📎 dans
// le champ. `onSend` est optionnel (coquille sans envoi réel).
//
// DEUX DISPOSITIONS (2026-09-15, premiers brouillons réels) :
//   · COMPACTE — une ligne : le champ, le trombone à sa droite, le bouton rond à
//     l'extérieur. C'est la réponse courte de messagerie.
//   · ÉLARGIE — dès que le texte passe sur plusieurs lignes, ou qu'un brouillon
//     de Relvo est en rédaction ou posé : le champ prend TOUTE la largeur, et les
//     boutons (trombone, envoi) descendent sur une rangée sous le texte. Un
//     e-mail se relit sur une largeur d'e-mail, pas dans une colonne rognée par
//     deux boutons. On repasse en compact quand le champ est vide.
//
// PLUS AUCUN CHOIX ENTRE CROCHETS (2026-09-16, troisième essai réel) : ce
// qu'un message demande au dirigeant se décide dans le FORMULAIRE DE DÉCISIONS
// de la conversation (`conversations/decision-sheet.tsx`), avant que Relvo ne
// rédige. Le brouillon arrive donc entier, sans crochet ; le composer ne
// surligne ni ne bloque plus rien. Le champ reste un textarea natif.
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
  /** « Basé sur : … » — les instructions, documents ou précédents cités par Relvo (05 §10.4). */
  sources?: string[];
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

/** Trois points qui respirent — « Relvo rédige ». */
function ThinkingDots() {
  return (
    <span className="ml-0.5 inline-flex items-center gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-[4px] animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

// Métriques du champ, partagées avec le skeleton de rédaction.
const FIELD_METRICS =
  "py-1.5 text-[14.5px] leading-[1.4] break-words whitespace-pre-wrap";

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
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Le brouillon se pose dans le champ à son arrivée, une seule fois par
  // texte (`seen`) : l'utilisateur reste libre de le retoucher ensuite. `posed`
  // dit qu'un brouillon est DANS le champ — levé à l'envoi et à l'effacement,
  // avec la barre qui l'accompagne.
  const [seen, setSeen] = useState<string | null>(null);
  const [posed, setPosed] = useState(false);
  const draftText = draft?.text ?? null;
  if (draftText !== null && draftText !== seen) {
    setSeen(draftText);
    setPosed(true);
    setText(draftText);
  }
  const loading = Boolean(draft?.loading);
  const showDraftBar = loading || posed;
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

  // Disposition élargie : à verrou — on y entre dès que le texte dépasse une
  // ligne (mesuré à la frappe) ou qu'un brouillon est là, on n'en sort que le
  // champ vidé, pour ne pas osciller quand le texte, plus large, retiendrait
  // sur une ligne.
  const [multiline, setMultiline] = useState(false);
  const expanded = showDraftBar || multiline;
  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setText(next);
    if (!next.trim()) setMultiline(false);
    else if (e.currentTarget.scrollHeight > 40) setMultiline(true);
  }

  // Textarea auto-croissante : un email fait plusieurs lignes, on agrandit le
  // champ jusqu'à un plafond (puis scroll interne) plutôt qu'une ligne unique.
  const maxHeight = expanded ? 240 : 168;
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text, maxHeight, loading]);

  const [sending, setSending] = useState(false);
  const blocked = sending || loading;
  const send = async () => {
    if (!typing || blocked) return;
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
        setPosed(false);
        setMultiline(false);
      }
    } finally {
      setSending(false);
    }
  };

  const barLabel = loading ? (
    <>
      Relvo rédige votre réponse
      <ThinkingDots />
    </>
  ) : (
    "Brouillon de Relvo — modifiez librement avant d'envoyer"
  );
  // Les citations du brouillon (05 §10.4) : un encart minimal, une ligne,
  // sous l'étiquette — l'utilisateur sait d'où vient ce qu'il va envoyer.
  const sources = !loading && posed ? (draft?.sources ?? []) : [];

  const attachButton = attach ? (
    <button
      type="button"
      aria-label="Joindre un fichier"
      className="grid flex-none place-items-center py-1.5 text-white/85"
    >
      <Paperclip className="size-5" strokeWidth={2} />
    </button>
  ) : null;

  const sendButton = (
    <button
      type="button"
      onClick={send}
      disabled={blocked}
      aria-label={typing ? "Envoyer" : "Dicter"}
      className={cn(
        "grid flex-none place-items-center rounded-full bg-white text-relvo active:scale-95 disabled:opacity-60",
        expanded ? "size-[36px]" : "size-[42px]",
      )}
      style={{ boxShadow: "0 5px 16px rgb(0 0 0 / 0.22)" }}
    >
      {typing ? (
        <Send
          className={expanded ? "size-[17px]" : "size-[19px]"}
          strokeWidth={2}
        />
      ) : (
        <Mic className={expanded ? "size-[18px]" : "size-5"} strokeWidth={2} />
      )}
    </button>
  );

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
        <div
          className="flex items-center gap-2 px-1 text-[12.5px] font-semibold text-white/90"
          aria-live="polite"
        >
          <Sparkles
            className={cn("size-3.5 flex-none", loading && "animate-pulse")}
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center truncate">{barLabel}</span>
            {sources.length ? (
              <span
                className="truncate text-[11.5px] font-medium text-white/75"
                title={`Basé sur : ${sources.join(", ")}`}
              >
                Basé sur : {sources.join(", ")}
              </span>
            ) : null}
          </span>
          {!loading && draft?.onRegenerate ? (
            <button
              type="button"
              onClick={draft.onRegenerate}
              aria-label="Régénérer le brouillon"
              className="grid size-7 flex-none place-items-center rounded-full text-white/85 active:bg-white/15"
            >
              <RefreshCw className="size-[15px]" strokeWidth={2.2} />
            </button>
          ) : null}
          {!loading && draft?.onClear ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                setPosed(false);
                setMultiline(false);
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
          className={cn(
            "flex min-w-0 flex-1 rounded-[22px]",
            expanded
              ? "flex-col px-[15px] pt-[5px] pb-[7px]"
              : "items-end gap-[7px] py-[5px] pr-1.5 pl-[15px]",
          )}
          style={{
            background: "rgb(255 255 255 / 0.06)",
            border: "1px solid rgb(255 255 255 / 0.28)",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.04)",
          }}
        >
          {loading ? (
            // Relvo rédige : le champ montre des lignes qui respirent, pas un
            // vide figé — le brouillon arrive en quelques secondes.
            <div
              className="min-w-0 flex-1 space-y-2.5 py-2.5"
              role="status"
              aria-label="Relvo rédige votre réponse"
            >
              {["88%", "72%", "52%"].map((w) => (
                <span
                  key={w}
                  className="block h-[11px] animate-pulse rounded-full bg-white/30"
                  style={{ width: w }}
                />
              ))}
            </div>
          ) : (
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={taRef}
                value={text}
                rows={1}
                onChange={onChange}
                onKeyDown={(e) => {
                  // Email multi-ligne : Entrée = saut de ligne ; ⌘/Ctrl+Entrée = envoi.
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={ph}
                className={cn(
                  "relative block w-full min-w-0 resize-none border-none bg-transparent text-white outline-none placeholder:text-white/70",
                  FIELD_METRICS,
                )}
                style={{ maxHeight }}
              />
            </div>
          )}

          {expanded ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              {attachButton ?? <span />}
              {sendButton}
            </div>
          ) : (
            attachButton
          )}
        </div>

        {expanded ? null : sendButton}
      </div>
    </div>
  );
}
