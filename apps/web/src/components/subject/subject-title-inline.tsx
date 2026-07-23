"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSubjectAction } from "@/server/actions/subjects";

// Renommer un sujet en tapant son titre dans le header (2026-07-20).
//
// Avant, il fallait ouvrir l'onglet « Détails » pour un geste aussi banal que
// corriger un intitulé mal deviné par Relvo — trois taps pour un mot. On rend
// donc le titre du hero éditable SUR PLACE. L'onglet Détails reste : ce n'est
// pas un déplacement de fonctionnalité mais un raccourci sur le chemin le plus
// court, et les deux passent par `updateSubjectAction` — donc le journal de bord
// consigne « Nom modifié : « X » → « Y » » de la même façon des deux côtés.
//
// AFFORDANCE : aucun cadre au repos — un titre doit rester un titre, pas un
// formulaire posé dans le hero. La découvrabilité passe par le curseur texte,
// un léger voile au tap et un `title`/aria explicites ; en édition, le champ
// prend un fond translucide + un liseré blanc pour dire « vous écrivez ».
//
// Pas de composant shadcn ici : le registre n'expose rien d'équivalent (aucun
// « inline edit » / « editable text »), on compose donc sur mesure avec les
// tokens du thème — dernier recours prévu par la convention.
//
// OPTIMISTE : le titre affiché change immédiatement ; en cas d'échec on revient
// à la valeur serveur et un toast le dit. Un titre vide n'est jamais enregistré
// (c'est une annulation, pas une suppression de nom).

export function SubjectTitleInline({
  subjectId,
  title,
}: {
  subjectId: string;
  title: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  // Échap doit annuler SANS enregistrer — or il fait aussi perdre le focus, et
  // le blur, lui, enregistre. Ce drapeau désarme le blur pour un tour.
  const cancelled = useRef(false);

  // Titre optimiste : `{ from, to }` où `from` est la valeur serveur au moment
  // de l'enregistrement. On le DÉRIVE au rendu au lieu de resynchroniser un
  // état dans un `useEffect` — dès que le serveur renvoie autre chose que
  // `from` (notre écriture confirmée, un renommage depuis l'onglet Détails, ou
  // le poll 30 s), l'optimisme se périme tout seul et la prop reprend la main.
  const [optimistic, setOptimistic] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const shown = optimistic?.from === title ? optimistic.to : title;

  function open() {
    setValue(shown);
    setEditing(true);
    // Focus après le rendu de l'input, curseur en fin de texte.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  function cancel() {
    cancelled.current = true;
    setValue(shown);
    setEditing(false);
  }

  function save() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = value.trim();
    setEditing(false);
    // Vide ou inchangé → rien à écrire (un sujet sans nom n'existe pas).
    if (!next || next === shown) {
      setValue(shown);
      return;
    }
    const previous = shown;
    setOptimistic({ from: title, to: next }); // affiché immédiatement
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, { title: next });
      if (res.ok) {
        router.refresh();
      } else {
        setOptimistic(null); // on retombe sur la valeur serveur
        setValue(previous);
        toast.error(res.message);
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        aria-label="Nom du sujet"
        // Même typo que le <h1> parent : le titre ne doit pas sauter de taille
        // au moment où l'on commence à écrire.
        className="w-full border-b-2 border-white/70 bg-white/10 font-heading text-[19px] font-extrabold tracking-[-0.3px] text-white outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Renommer le sujet"
      aria-label={`Renommer le sujet : ${shown}`}
      // Titre lisible EN ENTIER (2 lignes) — plus de liseré pointillé sous le
      // titre (retiré le 2026-07-23) : l'affordance passe par le curseur texte
      // et le voile au survol, pas par une barre décorative qui encombrait le
      // hero.
      className="block w-full cursor-text text-left font-heading text-[19px] leading-[1.15] font-extrabold tracking-[-0.3px] text-white transition-colors hover:bg-white/10"
    >
      {shown}
    </button>
  );
}
