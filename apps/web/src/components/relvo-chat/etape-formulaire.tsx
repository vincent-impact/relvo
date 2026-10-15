"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// EtapeFormulaire — une QUESTION de Relvo sous forme de formulaire (05-ia
// §11.11, « les questions sont des formulaires, dans la couleur de Relvo ») :
// une question courte, deux à quatre réponses COMPLÈTES, chacune avec sa
// destination, jamais un choix dans le texte. C'est la forme des décisions
// d'une tâche de réponse (§3.1) et celle des étapes de la prise en main que
// M10.16 enchaînera dans l'échange ; M19.9 lui donne son rendu et son mouvement,
// et un premier consommateur : la dernière diapositive de la première
// connexion. La logique de l'étape — quelle réponse modifie quel objet — reste
// chez l'appelant.
//
// Le composant se pose DANS un bloc de Relvo (`RelvoBlock`) : il n'a pas de
// matière à lui. Les réponses sont des options blanches à filet, sans ombre
// (une carte ne contient pas une carte), de 48 px — la cible d'un pouce.

export type EtapeOption<K extends string = string> = {
  key: K;
  label: string;
  /** Ce que la réponse engage, en une ligne grise. */
  hint?: string;
  /** Une réponse secondaire (« Plus tard », « Autre… ») : texte seul, sans option. */
  secondary?: boolean;
};

export function EtapeFormulaire<K extends string>({
  question,
  options,
  onChoose,
  busyKey = null,
  disabled = false,
  error = null,
}: {
  question: React.ReactNode;
  options: EtapeOption<K>[];
  onChoose: (key: K) => void;
  /** La réponse en cours de traitement : les autres se désactivent. */
  busyKey?: K | null;
  disabled?: boolean;
  /** Ce qui n'a pas marché, en langage client — sous les options. */
  error?: string | null;
}) {
  const primary = options.filter((o) => !o.secondary);
  const secondary = options.filter((o) => o.secondary);
  const locked = disabled || busyKey != null;
  return (
    <div>
      <p className="mt-1.5 text-[15px] leading-[21px] font-normal text-noir">
        {question}
      </p>
      <div className="mt-2.5 space-y-1.5">
        {primary.map((o) => {
          const busy = busyKey === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChoose(o.key)}
              disabled={locked}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-(--rayon-option) border border-(--filet) bg-white px-3.5 text-left",
                "transition-[background-color,opacity] active:bg-(--fond-enfonce) disabled:opacity-60",
                busy && "opacity-100!",
              )}
            >
              <span className="min-w-0 flex-1 py-2">
                <span className="block text-[14.5px] leading-[18px] font-normal text-noir">
                  {o.label}
                </span>
                {o.hint ? (
                  <span className="block text-[12px] leading-4 font-normal text-gris">
                    {o.hint}
                  </span>
                ) : null}
              </span>
              {busy ? (
                <Loader2
                  className="size-4 flex-none animate-spin text-relvo"
                  aria-label="Ouverture…"
                />
              ) : (
                <ChevronRight className="size-4 flex-none text-(--gris-clair)" />
              )}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-[12px] leading-4 font-normal text-urgent">
          {error}
        </p>
      ) : null}
      {secondary.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChoose(o.key)}
          disabled={locked}
          className="mt-1 block w-full py-2 text-center text-[14px] font-medium text-relvo active:opacity-80 disabled:opacity-60"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
