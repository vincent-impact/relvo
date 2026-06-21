"use client";

import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Composer de réponse de la fiche Sujet (in-flow dans l'onglet Messages).
// Brouillon Relvo identifié « Suggestion de Relvo — modifiez librement avant
// d'envoyer » : un tap insère le texte dans le champ (jamais envoyé directement,
// invariant n°9/25). L'envoi réel arrive avec M5/M6 — ici c'est une coquille.

export function SubjectReplyComposer({
  channelLabel,
  recipientName,
  draft,
}: {
  channelLabel: string;
  recipientName: string;
  draft: string | null;
}) {
  const [value, setValue] = useState("");
  const [showDraft, setShowDraft] = useState(Boolean(draft));
  const ref = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function insertDraft() {
    if (!draft) return;
    setValue(draft);
    setShowDraft(false);
    requestAnimationFrame(() => {
      autoGrow();
      ref.current?.focus();
    });
  }

  const typing = value.trim().length > 0;

  return (
    <div className="mt-3.5 border-t border-(--border-light) pt-3">
      {showDraft && draft ? (
        <button
          type="button"
          onClick={insertDraft}
          className="mb-2 flex w-full items-center gap-2 rounded-lg border border-(--purple-100) bg-relvo-bg px-3 py-2.5 text-left text-[12.5px] font-semibold text-relvo"
        >
          <span>✦</span>
          <span className="flex-1">
            Suggestion de Relvo — appuyez pour l'insérer
          </span>
          <span
            role="button"
            tabIndex={-1}
            aria-label="Effacer le brouillon"
            onClick={(e) => {
              e.stopPropagation();
              setShowDraft(false);
            }}
            className="font-bold opacity-65"
          >
            ✕
          </span>
        </button>
      ) : null}

      <div className="flex items-end gap-2.5">
        <span className="inline-flex flex-none items-center rounded-full border border-(--border) bg-(--surface) px-2.5 py-2 text-[12px] font-semibold text-(--text-secondary)">
          {channelLabel}
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          placeholder={`Répondre à ${recipientName}…`}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[20px] border border-(--border) bg-(--surface) px-3.5 py-2.5 text-sm leading-snug outline-none"
        />
        <button
          type="button"
          aria-label="Joindre un fichier"
          className={cn(
            "grid size-[38px] flex-none place-items-center rounded-full border border-(--border) bg-(--surface) text-(--text-secondary)",
            typing && "hidden",
          )}
        >
          <Paperclip className="size-[18px]" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Envoyer"
          onClick={() => toast.info("L'envoi arrive avec les canaux (M5/M6).")}
          className={cn(
            "grid size-[38px] flex-none place-items-center rounded-full bg-brand text-white",
            !typing && "hidden",
          )}
        >
          <Send className="size-[18px]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
