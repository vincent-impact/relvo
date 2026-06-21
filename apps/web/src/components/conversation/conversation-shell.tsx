"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, History, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { AppBar } from "@/components/layout/app-bar";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { cn } from "@/lib/utils";

// Coquille de conversation plein écran (M9 / ux-mobile-first §5). Navigable mais
// SANS IA : le streaming, les tools et le stockage IndexedDB arrivent en M10.
// Empty-state (orb + prompts cliquables qui pré-remplissent) + composer.

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
      <AppBar
        back={backHref}
        title={
          <span className="flex items-center gap-1.5 text-[16px]">
            <span className="text-relvo">✦</span> Relvo
          </span>
        }
        subtitle="Nouvelle conversation"
        action={
          <Link
            href="/conversations"
            aria-label="Mes conversations"
            className="grid size-[38px] flex-none place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
          >
            <History className="size-[19px]" strokeWidth={2} />
          </Link>
        }
      />

      {contextLabel ? (
        <div className="flex items-center gap-2 border-b border-(--border-light) bg-(--surface) px-4 py-2 text-[12.5px] text-(--text-secondary)">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border) bg-white px-2.5 py-1 font-semibold text-(--text-primary)">
            Contexte : {contextLabel}
          </span>
          <Link
            href="/conversation"
            aria-label="Discussion générale"
            className="ml-auto grid size-6 place-items-center rounded-full bg-(--surface-2) text-(--text-tertiary)"
          >
            ✕
          </Link>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto bg-(--surface) px-[18px] py-6">
        <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
          <div className="grid size-[52px] place-items-center rounded-full bg-relvo text-2xl text-white">
            ✦
          </div>
          <h3 className="text-[17px] font-bold">Comment puis-je t'aider ?</h3>
          <p className="text-[13.5px] text-(--text-secondary)">
            Pose ta question ou demande-moi une action.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => fill(p)}
              className="rounded-lg border border-dashed border-(--border) px-3 py-2.5 text-left text-sm text-(--text-tertiary) italic"
            >
              {p}
            </button>
          ))}
        </div>
      </main>

      <div className="flex-none px-3 pt-1.5 text-center text-[11.5px] text-(--text-tertiary)">
        🎙 <b className="font-semibold text-relvo">Maintiens le micro</b> pour
        parler, ou écris ci-dessous
      </div>
      <div
        className="flex flex-none items-end gap-2.5 border-t border-(--hairline) bg-white px-3 py-2.5"
        style={{ boxShadow: "var(--shadow-up)" }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          placeholder="Écrire à Relvo…"
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[20px] border border-(--border) bg-(--surface) px-3.5 py-2.5 text-sm leading-snug outline-none"
        />
        <button
          type="button"
          aria-label="Prendre une photo"
          className={cn(
            "grid size-[38px] flex-none place-items-center rounded-full border border-(--border) bg-(--surface) text-(--text-secondary)",
            typing && "hidden",
          )}
        >
          <Camera className="size-[18px]" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Dicter"
          className={cn(
            "grid size-[42px] flex-none place-items-center rounded-full bg-relvo text-white shadow-[0_2px_8px_rgba(107,91,214,0.35)]",
            typing && "hidden",
          )}
        >
          <Mic className="size-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Envoyer"
          onClick={() =>
            toast.info("La conversation avec Relvo arrive en M10.")
          }
          className={cn(
            "grid size-[38px] flex-none place-items-center rounded-full bg-brand text-white",
            !typing && "hidden",
          )}
        >
          <Send className="size-[18px]" strokeWidth={2} />
        </button>
      </div>
    </MobileFrame>
  );
}
