"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { History, Mic, Paperclip, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";

// Coquille de conversation plein écran (M9 / ux-mobile-first §5), Direction B :
// hero violet (logo = historique) + empty-state (orb + prompts cliquables qui
// pré-remplissent) + composer violet « Liquid Glass ». SANS IA : le streaming,
// les tools et le stockage IndexedDB arrivent en M10.

export function ConversationShell({
  backHref,
  contextLabel,
  prompts,
}: {
  backHref: string;
  /** Libellé du chip page-aware, ou null pour une discussion générale. */
  contextLabel: string | null;
  prompts: string[];
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const typing = value.trim().length > 0;

  function autoGrow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function fill(text: string) {
    setValue(text);
    requestAnimationFrame(() => {
      autoGrow();
      ref.current?.focus();
    });
  }

  return (
    <MobileFrame>
      <RelvoHeader
        back={backHref}
        title="Relvo"
        subtitle="Nouvelle conversation"
        relvo={false}
        action={
          <Link
            href="/conversations"
            aria-label="Historique des conversations"
            className="grid size-[38px] flex-none place-items-center rounded-full active:scale-95"
            style={{ background: "rgb(255 255 255 / 0.16)" }}
          >
            <History className="size-5" strokeWidth={2} />
          </Link>
        }
      />

      {contextLabel ? (
        <div className="flex flex-none items-center gap-2 border-b border-(--border-light) px-4 py-2 text-[12.5px] text-(--text-secondary)">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border) bg-white px-2.5 py-1 font-semibold text-(--text-primary)">
            Contexte : {contextLabel}
          </span>
          <Link
            href="/conversation"
            aria-label="Discussion générale"
            className="ml-auto grid size-6 place-items-center rounded-full bg-(--surface-2) text-(--text-tertiary)"
          >
            <X className="size-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto bg-white px-[18px] py-7">
        <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
          <div className="grid size-[52px] place-items-center rounded-full bg-relvo text-white shadow-(--shadow-relvo)">
            <Sparkles className="size-6" fill="currentColor" strokeWidth={0} />
          </div>
          <h3 className="font-heading text-[19px] font-extrabold tracking-[-0.3px]">
            Comment puis-je vous aider ?
          </h3>
          <p className="text-[13.5px] text-(--text-secondary)">
            Posez votre question ou demandez-moi une action.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => fill(p)}
              className="rounded-xl border border-dashed border-(--border) px-3.5 py-3 text-left text-[13.5px] text-(--text-tertiary) italic"
            >
              {p}
            </button>
          ))}
        </div>
      </main>

      <div
        className="relative flex flex-none items-center gap-2.5 px-3.5 pt-[11px]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          background:
            "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
          backdropFilter: "blur(28px) saturate(170%)",
          WebkitBackdropFilter: "blur(28px) saturate(170%)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.34)",
        }}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-[7px] rounded-[22px] py-[5px] pr-2 pl-[13px]"
          style={{
            background: "rgb(255 255 255 / 0.06)",
            border: "1px solid rgb(255 255 255 / 0.28)",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.04)",
          }}
        >
          <button
            type="button"
            aria-label="Joindre un fichier"
            className="grid flex-none place-items-center text-white/85"
          >
            <Paperclip className="size-[21px]" strokeWidth={2} />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow();
            }}
            placeholder="Écrire à Relvo…"
            className="max-h-[120px] min-h-[24px] flex-1 resize-none border-none bg-transparent py-1.5 text-[14.5px] leading-snug text-white outline-none placeholder:text-white/70"
          />
        </div>
        <button
          type="button"
          aria-label={typing ? "Envoyer" : "Dicter"}
          onClick={() =>
            typing && toast.info("La conversation avec Relvo arrive en M10.")
          }
          className="grid size-[45px] flex-none place-items-center rounded-full bg-white text-relvo active:scale-95"
          style={{ boxShadow: "0 5px 16px rgb(0 0 0 / 0.22)" }}
        >
          {typing ? (
            <Send className="size-[19px]" strokeWidth={2} />
          ) : (
            <Mic className="size-5" strokeWidth={2} />
          )}
        </button>
      </div>
    </MobileFrame>
  );
}
