"use client";

import { EyeOff, Link2, Plus, Trash2, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Pop-up de CLASSEMENT d'une conversation (2026-09-07, retour bêta) — surface
// unique de triage, partagée par les deux points d'entrée :
//   • page /conversations  → swipe DROITE sur une ligne (sans « Ignorer » : le
//     swipe GAUCHE le fait déjà, et doubler le geste sèmerait le doute) ;
//   • /conversations/[id]  → bouton unique « Classer » (avec « Ignorer », car il
//     n'y a pas de swipe dans le détail — il remplace les 3 boutons du dock).
//
// Pourquoi une pop-up plutôt que deux swipes distincts : « nouveau sujet » et
// « rattacher à un sujet existant » sont à PARITÉ (invariant n°13bis, M6ter.5bis)
// — le second est le seul dispositif prévu pour le changement d'objet (cas M) et
// le changement d'adresse (cas X). Un swipe ne peut en exposer qu'un ; la pop-up
// les met côte à côte.
//
// ⚠️ Elle ne DÉCIDE de rien : elle appelle les callbacks du parent, qui restent
// responsables du canal. En messagerie, « nouveau sujet » doit encore faire
// désigner le message d'ancrage (l'écoute commence là) — d'où le libellé adouci.

function Choice({
  icon: Icon,
  label,
  hint,
  tone = "default",
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  tone?: "default" | "danger";
  onSelect: () => void;
}) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        danger
          ? "border-(--border) active:bg-(--red-50)"
          : "border-(--border) active:bg-relvo-bg",
      )}
    >
      <span
        className={cn(
          "grid size-9 flex-none place-items-center rounded-full",
          danger ? "bg-(--red-50) text-(--red-600)" : "bg-relvo-bg text-relvo",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[14.5px] font-bold",
            danger ? "text-(--red-600)" : "text-(--text-primary)",
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.35] text-(--text-tertiary)">
          {hint}
        </span>
      </span>
    </button>
  );
}

export function ConversationTriageDialog({
  open,
  onOpenChange,
  isEmail,
  hasSubjects = true,
  onCreate,
  onLink,
  onIgnore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** E-mail : le geste porte sur TOUT le fil. Messagerie : il faudra une ancre. */
  isEmail: boolean;
  /** Connu seulement dans le détail (qui charge les sujets ouverts) : l'indice
   *  devient alors honnête. Depuis la liste on l'ignore — le détail préviendra. */
  hasSubjects?: boolean;
  onCreate: () => void;
  onLink: () => void;
  /** Fourni uniquement dans le détail (le swipe gauche s'en charge en liste). */
  onIgnore?: () => void;
}) {
  function pick(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-5">
        <DialogHeader>
          <DialogTitle>Classer cette conversation</DialogTitle>
          <DialogDescription>
            {isEmail
              ? "Le fil entier rejoindra le sujet."
              : "Vous choisirez ensuite le message à partir duquel le sujet écoute ce fil."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Choice
            icon={Plus}
            label="Nouveau sujet"
            hint="Ouvrir un sujet sur cette conversation."
            onSelect={() => pick(onCreate)}
          />
          <Choice
            icon={Link2}
            label="Lier à un sujet existant"
            hint={
              hasSubjects
                ? "Rattacher ce fil à une affaire déjà suivie."
                : "Aucun sujet ouvert pour l'instant."
            }
            onSelect={() => pick(onLink)}
          />
          {onIgnore ? (
            <Choice
              icon={isEmail ? Trash2 : EyeOff}
              label={isEmail ? "Supprimer" : "Ignorer"}
              tone="danger"
              hint="Faire taire cette source. Aucune donnée n'est supprimée."
              onSelect={() => pick(onIgnore)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
