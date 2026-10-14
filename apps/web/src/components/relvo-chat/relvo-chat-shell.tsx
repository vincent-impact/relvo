"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  ClockCounterClockwise,
  Microphone,
  PaperPlaneRight,
  Paperclip,
} from "@/components/shared/picto";
import { toast } from "sonner";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";

// Coquille de conversation plein écran (M9 / ux-mobile-first §5) : le ciel
// court (retour, historique), le chip de contexte, l'état vide (le disque de
// Relvo et des invites en options pointillées qui pré-remplissent), et le
// composer BLANC ancré en bas — champ gris, disque violet pour dicter ou
// envoyer — qui prend la place du dock. SANS IA : le streaming, les tools et le
// stockage IndexedDB arrivent en M10.

export function RelvoChatShell({
  backHref,
  contextLabel,
  prompts,
  initialText = "",
}: {
  backHref: string;
  /** Libellé du chip page-aware, ou null pour une discussion générale. */
  contextLabel: string | null;
  prompts: string[];
  /** Premier tour proposé (une suggestion de l'accueil) : pré-rempli, jamais envoyé seul. */
  initialText?: string;
}) {
  const [value, setValue] = useState(initialText);
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
        action={
          <Link
            href="/relvo/historique"
            aria-label="Historique des conversations"
            className={SKY_BTN}
          >
            <ClockCounterClockwise className="size-[17px]" />
          </Link>
        }
      />

      {contextLabel ? (
        <div className="flex flex-none items-center gap-2 px-4 pt-3 pb-1 text-[12px] text-gris">
          <span className="inline-flex h-7 min-w-0 items-center gap-1.5 truncate rounded-(--rayon-pilule) border border-(--filet) bg-white px-3 font-normal text-noir">
            Contexte : {contextLabel}
          </span>
          <Link
            href="/relvo"
            aria-label="Discussion générale"
            className="ml-auto grid size-7 place-items-center rounded-full bg-(--fond-puce) text-gris"
          >
            <X className="size-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto bg-background px-[18px] py-7">
        <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
          <div
            className="grid size-14 place-items-center rounded-full text-white shadow-disque"
            style={{ background: "var(--degrade-disque)" }}
          >
            <svg
              viewBox="116 104 296 296"
              width="30"
              height="30"
              fill="currentColor"
              aria-hidden="true"
            >
              {RELVO_LOGO_PATHS.stars.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          </div>
          <h3 className="font-heading text-[22px] leading-7 font-semibold tracking-[-0.01em] text-noir">
            Comment puis-je vous aider ?
          </h3>
          <p className="text-[14px] font-light text-gris">
            Posez votre question ou demandez-moi une action.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => fill(p)}
              className="pressable flex h-11 items-center gap-2.5 rounded-(--rayon-pilule) border border-(--filet) bg-white px-4 text-left text-[14px] font-normal text-noir shadow-carte active:bg-(--fond-puce)"
            >
              {p}
            </button>
          ))}
        </div>
      </main>

      <div
        className="relative flex flex-none items-center gap-2.5 bg-white px-4 pt-2.5 shadow-haut"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[22px] bg-(--fond-puce) py-1 pr-2.5 pl-4">
          <button
            type="button"
            aria-label="Joindre un fichier"
            className="order-last grid flex-none place-items-center text-gris"
          >
            <Paperclip className="size-5" />
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
            className="max-h-[120px] min-h-[24px] flex-1 resize-none border-none bg-transparent py-1.5 text-[14.5px] leading-snug font-light text-noir outline-none placeholder:text-gris"
          />
        </div>
        <button
          type="button"
          aria-label={typing ? "Envoyer" : "Dicter"}
          onClick={() =>
            typing && toast.info("La conversation avec Relvo arrive en M10.")
          }
          className="pressable grid size-11 flex-none place-items-center rounded-full text-white shadow-disque"
          style={{ background: "var(--degrade-disque)" }}
        >
          {typing ? (
            <PaperPlaneRight className="size-[19px]" />
          ) : (
            <Microphone className="size-5" />
          )}
        </button>
      </div>
    </MobileFrame>
  );
}
