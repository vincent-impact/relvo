"use client";

import { FeedTabs } from "@/components/feed/feed-tabs";
import {
  BookOpen,
  Folder,
  Note,
  Tray,
  type Picto,
} from "@/components/shared/picto";

// Les quatre onglets d'un dossier (M27.3), à icône : Dossiers · Sujets ·
// Instructions · Connaissances. Le serveur ne peut pas passer une icône (une
// fonction) à un composant client : il passe sa CLÉ, et c'est ici qu'elle
// devient un dessin — même mécanique que les onglets de la fiche d'un sujet.

export type OngletDossier = {
  value: "dossiers" | "sujets" | "instructions" | "connaissances";
  label: string;
  count: number;
};

const ICONES: Record<OngletDossier["value"], Picto> = {
  dossiers: Folder,
  sujets: Tray,
  instructions: Note,
  connaissances: BookOpen,
};

export function DossierTabs({
  options,
  panes,
  defaultValue,
  overlap,
}: {
  options: OngletDossier[];
  panes: Partial<Record<OngletDossier["value"], React.ReactNode>>;
  defaultValue: OngletDossier["value"];
  /** La carte chevauche le ciel quand rien ne la précède (Général, sans description). */
  overlap: boolean;
}) {
  return (
    <FeedTabs
      options={options.map((o) => ({ ...o, icon: ICONES[o.value] }))}
      panes={panes}
      defaultValue={defaultValue}
      overlap={overlap}
      iconOnly
    />
  );
}
