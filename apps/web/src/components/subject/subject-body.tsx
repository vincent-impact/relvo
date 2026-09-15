"use client";

import { useState } from "react";
import { FileText, History, ListChecks, MessagesSquare } from "lucide-react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";

// Orchestrateur de la fiche Sujet (corps interactif). QUATRE onglets
// (2026-09-15) : Informations · Conversations · Documents · Journal. La page
// principale porte le domaine, le résumé ET LES TÂCHES : le sujet, c'est ce
// qu'il reste à faire, on n'a pas à changer d'onglet pour le voir. Le journal,
// qu'on n'ouvre que pour comprendre ce que Relvo a fait, passe en dernier.
// L'icône de l'onglet principal est une liste cochée, pas un « i » : ce qu'on y
// trouve, c'est la fiche et ce qu'il reste à faire, et son compteur compte les
// tâches ouvertes.
// Les conversations sont une simple LISTE (plus de fil embarqué ni de composer
// ici) : on clique une ligne pour ouvrir la conversation dans son écran dédié
// (`/conversations/[id]`), seule surface d'affichage. On répond LÀ-BAS.
//
// ⚠️ AUCUN dock d'action ici (2026-09-07, retour bêta). Valider / Fermer /
// Remettre / Supprimer se font TOUS au swipe sur la page Sujets : les boutons de
// la fiche doublonnaient ces gestes et, affichés en grand sous le contenu,
// déroutaient plus qu'ils ne servaient.

export type SubjectTab =
  | "informations"
  | "conversations"
  | "documents"
  | "journal";

export function SubjectBody({
  header,
  defaultTab = "informations",
  tasksCount,
  conversationsCount,
  conversationsHasNew,
  informationsPane,
  conversationsPane,
  documentsPane,
  documentsCount,
  journalPane,
  journalCount,
}: {
  header: React.ReactNode;
  defaultTab?: SubjectTab;
  /** Tâches ouvertes — compteur de l'onglet principal. */
  tasksCount: number;
  /** Nombre total de conversations (compteur neutre, homogène aux autres onglets). */
  conversationsCount: number;
  /** Au moins un fil a du non-lu → point rouge sur l'icône. */
  conversationsHasNew: boolean;
  informationsPane: React.ReactNode;
  conversationsPane: React.ReactNode;
  documentsPane: React.ReactNode;
  documentsCount: number;
  journalPane: React.ReactNode;
  journalCount: number;
}) {
  const [tab, setTab] = useState<SubjectTab>(defaultTab);

  const options: SegTabOption[] = [
    {
      value: "informations",
      label: "Informations et tâches",
      icon: ListChecks,
      count: tasksCount,
    },
    {
      value: "conversations",
      label: "Conversations",
      icon: MessagesSquare,
      count: conversationsCount,
      // Point rouge = du non-lu quelque part ; le compteur reste neutre.
      dot: conversationsHasNew,
    },
    {
      value: "documents",
      label: "Documents",
      icon: FileText,
      count: documentsCount,
    },
    { value: "journal", label: "Journal", icon: History, count: journalCount },
  ];

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-background">
        {header}
        <SegTabs
          options={options}
          value={tab}
          onValueChange={(v) => setTab(v as SubjectTab)}
          overlap
          iconOnly
        />

        {tab === "informations" ? informationsPane : null}
        {tab === "conversations" ? conversationsPane : null}
        {tab === "documents" ? documentsPane : null}
        {tab === "journal" ? journalPane : null}
      </main>
    </>
  );
}
