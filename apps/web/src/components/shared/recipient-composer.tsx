"use client";

import { useState } from "react";
import { Check, ChevronUp, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// RecipientComposer — le composer signature de la Direction B qui lève
// l'ambiguïté « à qui j'écris ? ». Sélecteur de destinataire (avatar) à gauche ;
// toute la barre est BLEUE quand on écrit à un humain (Moi), VIOLETTE quand on
// parle à Relvo. Micro quand vide (voice-first), avion dès qu'on tape. 📎 dans
// le champ. Coquille M9 : `onSend` est optionnel (aucun envoi réel sans IA).

export type Recipient = {
  key: string;
  name: string;
  kind: "human" | "relvo";
  initials?: string;
  sublabel?: string;
};

function Avatar({
  r,
  size = 41,
  onLight = false,
}: {
  r: Recipient;
  size?: number;
  /** true : posé sur une surface claire (menu) → fond violet plein, pas translucide. */
  onLight?: boolean;
}) {
  if (r.kind === "relvo") {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-full",
          onLight && "bg-relvo",
        )}
        style={{
          width: size,
          height: size,
          background: onLight ? undefined : "rgb(255 255 255 / 0.2)",
        }}
      >
        <Sparkles
          className="size-[19px] text-white"
          fill="currentColor"
          strokeWidth={0}
        />
      </span>
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-(--amber-600) text-[13.5px] font-extrabold text-white"
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 0 2px rgb(255 255 255 / 0.35)",
      }}
    >
      {r.initials || r.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function RecipientComposer({
  recipients = [{ key: "relvo", name: "Relvo", kind: "relvo" }],
  defaultRecipient,
  placeholder,
  defaultValue = "",
  attach = true,
  onSend,
}: {
  recipients?: Recipient[];
  defaultRecipient?: string;
  placeholder?: string;
  defaultValue?: string;
  attach?: boolean;
  onSend?: (text: string, recipientKey: string) => void;
}) {
  const [cur, setCur] = useState(
    defaultRecipient || recipients[0]?.key || "relvo",
  );
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultValue);
  const r = recipients.find((x) => x.key === cur) || recipients[0];
  const human = r.kind === "human";
  const typing = text.trim().length > 0;
  const multi = recipients.length > 1;
  const ph =
    placeholder || (human ? `Répondre à ${r.name}…` : "Demander à Relvo…");

  const send = () => {
    if (!typing) return;
    onSend?.(text, cur);
    setText("");
  };

  return (
    <div className="relative">
      {open && multi ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[8] cursor-default"
          />
          <div
            className="absolute bottom-[76px] left-3 z-[9] w-[238px] rounded-[18px] bg-white p-[7px]"
            style={{ boxShadow: "0 16px 38px rgb(20 18 40 / 0.26)" }}
          >
            <div className="px-2.5 pt-[7px] pb-1.5 text-[10.5px] font-bold tracking-[0.4px] text-[#a8a69d] uppercase">
              Répondre à
            </div>
            {recipients.map((x) => (
              <button
                type="button"
                key={x.key}
                onClick={() => {
                  setCur(x.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-[11px] rounded-xl px-2.5 py-[9px] text-left",
                  x.key === cur && "bg-(--surface-2)",
                )}
              >
                <span className="flex-none">
                  <Avatar r={x} size={32} onLight />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{x.name}</span>
                  {x.sublabel ? (
                    <span className="block text-[11.5px] text-[#9a988f]">
                      {x.sublabel}
                    </span>
                  ) : null}
                </span>
                {x.key === cur ? (
                  <Check className="size-[17px] text-relvo" strokeWidth={2.6} />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div
        className="relative flex items-center gap-2.5 px-3.5 pt-[11px]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          background: human
            ? "linear-gradient(180deg, var(--glass-human-1), var(--glass-human-2))"
            : "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
          backdropFilter: "blur(28px) saturate(170%)",
          WebkitBackdropFilter: "blur(28px) saturate(170%)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.34)",
        }}
      >
        <button
          type="button"
          onClick={() => multi && setOpen((o) => !o)}
          aria-label="Destinataire"
          className={cn(
            "relative size-11 flex-none",
            multi ? "cursor-pointer" : "cursor-default",
          )}
        >
          <Avatar r={r} />
          {multi ? (
            <span className="absolute -right-px -bottom-px grid size-[17px] place-items-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)]">
              <ChevronUp className="size-2.5 text-[#6b6b6b]" strokeWidth={3} />
            </span>
          ) : null}
        </button>

        <div
          className="flex min-w-0 flex-1 items-center gap-[7px] rounded-full py-[5px] pr-2 pl-[13px]"
          style={{
            background: "rgb(255 255 255 / 0.06)",
            border: "1px solid rgb(255 255 255 / 0.28)",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.04)",
          }}
        >
          {attach ? (
            <button
              type="button"
              aria-label="Joindre un fichier"
              className="grid flex-none place-items-center text-white/85"
            >
              <Paperclip className="size-[21px]" strokeWidth={2} />
            </button>
          ) : null}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={ph}
            className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-[14.5px] text-white outline-none placeholder:text-white/70"
          />
        </div>

        <button
          type="button"
          onClick={send}
          aria-label={typing ? "Envoyer" : "Dicter"}
          className={cn(
            "grid size-[45px] flex-none place-items-center rounded-full bg-white active:scale-95",
            human ? "text-brand" : "text-relvo",
          )}
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
