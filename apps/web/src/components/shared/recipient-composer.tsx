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
// LES CHOIX ENTRE CROCHETS (M7.7) : quand Relvo n'a pas pu décider, son
// brouillon laisse le choix « [8 m³ / 12 m³] ». Tant qu'un brouillon est posé,
// ces segments sont SURLIGNÉS dans le champ (calque derrière le texte, mêmes
// métriques — jamais de gras ni d'italique, qui décaleraient le curseur) et
// l'ENVOI EST BLOQUÉ tant qu'il en reste : un dirigeant pressé fait confiance
// au brouillon sans le relire, on ne laisse pas partir un crochet à un
// fournisseur. Trancher = remplacer le segment par son choix.
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

/** Un choix laissé par Relvo : « [8 m³ / 12 m³] », « [à compléter] ». Jamais sur plusieurs lignes. */
const CHOICE_RE = /\[[^[\]\n]+\]/g;

/** Découpe le texte en segments, les choix marqués — pour le calque de surlignage. */
export function splitChoices(
  text: string,
): Array<{ text: string; choice: boolean }> {
  const out: Array<{ text: string; choice: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(CHOICE_RE)) {
    if (m.index > last)
      out.push({ text: text.slice(last, m.index), choice: false });
    out.push({ text: m[0], choice: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), choice: false });
  return out;
}

export function countChoices(text: string): number {
  return text.match(CHOICE_RE)?.length ?? 0;
}

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

// Le champ et son calque partagent EXACTEMENT ces métriques : c'est ce qui
// garde le curseur du champ aligné sur le texte du calque.
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
  // Les choix ne se comptent (et ne se surlignent) que sur un brouillon posé :
  // des crochets tapés à la main ne bloquent rien.
  const draftPosed = posed && !loading;
  const choicesLeft = draftPosed ? countChoices(text) : 0;
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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
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
  const blocked = sending || loading || choicesLeft > 0;
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
  ) : choicesLeft > 0 ? (
    `${choicesLeft} choix à trancher avant d'envoyer`
  ) : (
    "Brouillon de Relvo — modifiez librement avant d'envoyer"
  );

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
          className={cn(
            "flex items-center gap-2 px-1 text-[12.5px] font-semibold",
            choicesLeft > 0 ? "text-(--amber-100)" : "text-white/90",
          )}
          aria-live="polite"
        >
          <Sparkles
            className={cn("size-3.5 flex-none", loading && "animate-pulse")}
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="flex min-w-0 flex-1 items-center truncate">
            {barLabel}
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
              {/* Calque de surlignage des choix — derrière un champ au texte
                  transparent ; mêmes métriques, défilement synchronisé. */}
              {choicesLeft > 0 ? (
                <div
                  ref={overlayRef}
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 overflow-hidden text-white",
                    FIELD_METRICS,
                  )}
                >
                  {splitChoices(text).map((seg, i) =>
                    seg.choice ? (
                      <mark
                        key={i}
                        className="rounded-[3px] bg-(--amber-100) text-(--amber-800)"
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                  {/* Une ligne finale vide doit compter comme une ligne. */}
                  {text.endsWith("\n") ? "​" : null}
                </div>
              ) : null}
              <textarea
                ref={taRef}
                value={text}
                rows={1}
                onChange={onChange}
                onScroll={(e) => {
                  if (overlayRef.current)
                    overlayRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onKeyDown={(e) => {
                  // Email multi-ligne : Entrée = saut de ligne ; ⌘/Ctrl+Entrée = envoi.
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={ph}
                className={cn(
                  "relative block w-full min-w-0 resize-none border-none bg-transparent outline-none placeholder:text-white/70",
                  FIELD_METRICS,
                  choicesLeft > 0
                    ? "text-transparent caret-white"
                    : "text-white",
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
