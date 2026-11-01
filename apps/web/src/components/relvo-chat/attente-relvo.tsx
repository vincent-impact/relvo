import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EchangeRelvo } from "@relvo/db";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { urlEchangeRelvo } from "@/lib/echanges-regles";

// CE QUE RELVO ATTEND (05 §11.12, recette de l'alpha) : en tête de l'échange
// vide et de l'historique, un bloc de Relvo qui dit combien de choses il a à
// dire, puis UNE LIGNE PAR ÉCHANGE — jamais la question dépliée dans le fil du
// dirigeant. Chaque ligne ouvre l'échange de Relvo qui la porte. Les lignes
// sont blanches dans le bloc violet pâle, comme les réponses d'un formulaire.

function phrase(n: number): string {
  if (n === 1) return "J’ai une chose pour vous. Ouvrez-la quand vous voulez.";
  return `J’ai ${n} choses pour vous. Chacune est un échange à part : ouvrez celui que vous voulez.`;
}

export function AttenteRelvo({
  echanges,
  from = "/relvo",
  className,
}: {
  echanges: EchangeRelvo[];
  /** La page d'origine, pour le retour depuis l'échange ouvert. */
  from?: string;
  className?: string;
}) {
  if (echanges.length === 0) return null;
  return (
    <RelvoBlock className={className} label="Relvo vous attend">
      <RelvoSentence>{phrase(echanges.length)}</RelvoSentence>
      <div className="mt-2.5 space-y-1.5">
        {echanges.map((e) => (
          <Link
            key={e.cle}
            href={urlEchangeRelvo(e.cle, from)}
            className="flex min-h-12 items-center gap-3 rounded-(--rayon-option) border border-(--filet) bg-white px-3 py-2 text-left transition-[background-color] active:bg-(--fond-enfonce)"
          >
            <RelvoLogo
              size={22}
              variant="full"
              className="flex-none text-relvo-clair"
              title=""
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] leading-[19px] font-medium text-noir">
                {e.titre}
              </span>
              <span className="block truncate text-[12px] leading-4 font-normal text-gris">
                {e.sousTitre}
              </span>
            </span>
            <ChevronRight className="size-4 flex-none text-(--gris-clair)" />
          </Link>
        ))}
      </div>
    </RelvoBlock>
  );
}
