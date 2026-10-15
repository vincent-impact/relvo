"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader, SkyTail } from "@/components/layout/relvo-header";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { RecipientComposer } from "@/components/shared/recipient-composer";

// L'échange avec Relvo, plein écran — la coquille, avant M10 qui y posera la
// conversation. Relvo parle en premier (invariant 36) : l'état vide est un
// BLOC DE RELVO, pas un portrait qui demande ce qu'il peut faire, et les
// invites y sont des liens fléchés, la forme des suggestions de l'accueil. Le
// composer est CELUI des conversations : un seul composant, celui que M10
// branchera. Tant que Relvo ne répond pas ici, l'envoi le dit en langage
// client — jamais un code de sprint.

export function RelvoChatShell({
  backHref,
  contextLabel,
  prompts,
  initialText = "",
}: {
  backHref: string;
  /** Libellé du chip page-aware (le titre d'un sujet, « Sujets »), ou null. */
  contextLabel: string | null;
  prompts: string[];
  /** Premier tour proposé (une suggestion de l'accueil) : pré-rempli, jamais envoyé seul. */
  initialText?: string;
}) {
  // Une invite touchée se pose dans le composer : le composant repart avec
  // ce texte (la clé change), l'utilisateur l'envoie ou le corrige.
  const [seed, setSeed] = useState(initialText);
  const [seedKey, setSeedKey] = useState(0);

  function fill(text: string) {
    setSeed(text);
    setSeedKey((k) => k + 1);
  }

  return (
    <MobileFrame>
      {/* Le ciel est FIXE : sa queue se pose en tête de ce qui défile. */}
      <RelvoHeader back={backHref} title="Relvo" tail={false} />

      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4 pb-6">
        <SkyTail className="-mx-4 -mt-4" />
        {contextLabel ? (
          <div className="mb-3 flex">
            <span className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-(--rayon-pilule) border border-(--filet) bg-white pr-1 pl-3 text-[13px] font-normal text-noir shadow-carte">
              <span className="truncate">{contextLabel}</span>
              <Link
                href="/relvo"
                aria-label="Quitter ce contexte"
                className="relative grid size-7 flex-none place-items-center rounded-full text-gris before:absolute before:-inset-2 before:content-[''] active:bg-(--fond-puce)"
              >
                <X className="size-3.5" strokeWidth={2.4} />
              </Link>
            </span>
          </div>
        ) : null}

        <RelvoBlock className="pb-2">
          <RelvoSentence>Dites-moi ce que vous voulez faire.</RelvoSentence>
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => fill(p)}
              className="mt-0.5 block w-full py-1.5 pl-[1.1em] text-left -indent-[1.1em] text-[14px] leading-[18px] font-medium text-relvo active:opacity-80"
            >
              → {p}
            </button>
          ))}
        </RelvoBlock>
      </main>

      <RecipientComposer
        key={seedKey}
        placeholder="Écrire à Relvo…"
        defaultValue={seed}
        onSend={() => {
          toast.info("Relvo ne répond pas encore dans cet écran.");
          return false;
        }}
      />
    </MobileFrame>
  );
}
