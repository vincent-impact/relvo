"use client";

import { Plus } from "lucide-react";
import { SKY_BTN } from "@/components/layout/relvo-header";
import { EVENEMENT_AJOUT } from "@/components/feed/sujets-arbre";

// Le « + » du ciel en vue Dossiers (M28.2) : un dossier de premier niveau. Il
// vit dans l'en-tête de la page, l'arbre plus bas : il lui parle par un
// événement, et c'est l'arbre qui ouvre la feuille de création.

export function BoutonAjoutCiel() {
  return (
    <button
      type="button"
      aria-label="Nouveau dossier"
      onClick={() => window.dispatchEvent(new Event(EVENEMENT_AJOUT))}
      className={SKY_BTN}
    >
      <Plus className="size-4" strokeWidth={2.6} />
    </button>
  );
}
