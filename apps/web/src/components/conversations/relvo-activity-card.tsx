import Link from "next/link";
import type { RelvoActivitySummary } from "@relvo/db";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { formatRelative } from "@/lib/display";

// Le BILAN de Relvo en tête de l'onglet Conversations (M7, tranche 4) : ce
// qu'il a fait en l'absence de l'utilisateur — lu, fait taire, ouvert, rattaché,
// laissé à trier. Au début, c'est ce qui permet de vérifier qu'il fait bien le
// travail ; plus tard, l'utilisateur ne viendra plus vérifier, et la carte
// restera le résumé honnête de ce qui s'est passé.
//
// Chaque compteur est un LIEN vers le filtre qui montre les fils concernés :
// on ne lit pas un chiffre, on va voir.

function plural(n: number, one: string, many: string) {
  return n > 1 ? many : one;
}

export function RelvoActivityCard({
  summary,
  assistantEnabled,
  windowLabel,
}: {
  summary: RelvoActivitySummary;
  assistantEnabled: boolean;
  /** « ces 7 derniers jours ». */
  windowLabel: string;
}) {
  const { read, ignored, opened, attached, leftUnsorted, lastAt } = summary;

  return (
    <section
      aria-label="Ce que Relvo a fait"
      className="mx-4 mt-3 rounded-[14px] border border-(--hairline) bg-white px-4 py-3 shadow-surface-1"
    >
      <div className="flex items-center gap-2">
        <RelvoLogo size={18} variant="full" title="" className="text-relvo" />
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-(--text-primary)">
          {read === 0
            ? assistantEnabled
              ? "Relvo n'a encore rien trié"
              : "L'assistant Relvo est coupé"
            : `Relvo a lu ${read} ${plural(read, "conversation", "conversations")}`}
        </p>
        {lastAt ? (
          <span className="flex-none text-[11.5px] text-(--text-tertiary)">
            {formatRelative(lastAt)}
          </span>
        ) : null}
      </div>

      {read === 0 ? (
        <p className="mt-1 text-[12.5px] text-(--text-tertiary)">
          {assistantEnabled ? (
            <>Les prochains e-mails reçus seront lus et triés {windowLabel}.</>
          ) : (
            <>
              Activez-le dans{" "}
              <Link
                href="/parametres?tab=preferences"
                className="font-semibold text-relvo"
              >
                Réglages › Préférences
              </Link>{" "}
              pour qu’il trie les messages reçus.
            </>
          )}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-(--text-secondary)">
          <li>
            <Link
              href="/conversations?filtre=ignorees"
              className="tabular-nums"
            >
              <b className="text-(--text-primary)">{ignored}</b>{" "}
              {plural(ignored, "ignorée", "ignorées")}
            </Link>
          </li>
          <li>
            <Link href="/fil" className="tabular-nums">
              <b className="text-(--text-primary)">{opened}</b>{" "}
              {plural(opened, "sujet ouvert", "sujets ouverts")}
            </Link>
          </li>
          {attached > 0 ? (
            <li>
              <Link
                href="/conversations?filtre=suivies"
                className="tabular-nums"
              >
                <b className="text-(--text-primary)">{attached}</b>{" "}
                {plural(attached, "rattachée", "rattachées")}
              </Link>
            </li>
          ) : null}
          <li>
            <Link
              href="/conversations?filtre=sans-sujet"
              className="tabular-nums"
            >
              <b className="text-(--text-primary)">{leftUnsorted}</b>{" "}
              {plural(leftUnsorted, "laissée à trier", "laissées à trier")}
            </Link>
          </li>
          <li className="text-(--text-tertiary)">{windowLabel}</li>
        </ul>
      )}
    </section>
  );
}
