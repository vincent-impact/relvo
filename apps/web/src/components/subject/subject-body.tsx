"use client";

import { useState } from "react";
import { CalendarDays, FileText, Info, MessagesSquare } from "lucide-react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";

// Orchestrateur de la fiche Sujet (corps interactif). QUATRE onglets
// (2026-07-27) : Informations · Tâches · Conversations · Documents. Les
// conversations sont désormais une simple LISTE (plus de fil embarqué ni de
// composer ici) : on clique une ligne pour ouvrir la conversation dans son écran
// dédié (`/conversations/[id]`), seule surface d'affichage. On répond LÀ-BAS.
// Cela supersède les deux onglets par canal (M6quater) : le split e-mail/
// messagerie vit dans l'écran conversation, pas dans la fiche.
//
// ⚠️ AUCUN dock d'action ici (2026-09-07, retour bêta). Valider / Fermer /
// Remettre / Supprimer se font TOUS au swipe sur la page Sujets : les boutons de
// la fiche doublonnaient ces gestes et, affichés en grand sous le contenu,
// déroutaient plus qu'ils ne servaient.

type Tab = "informations" | "conversations" | "taches" | "documents";

export function SubjectBody({
  header,
  defaultTab = "informations",
  tasksCount,
  conversationsCount,
  conversationsHasNew,
  informationsPane,
  tachesPane,
  conversationsPane,
  documentsPane,
  documentsCount,
}: {
  header: React.ReactNode;
  defaultTab?: Tab;
  tasksCount: number;
  /** Nombre total de conversations (compteur neutre, homogène aux autres onglets). */
  conversationsCount: number;
  /** Au moins un fil a du non-lu → point rouge sur l'icône. */
  conversationsHasNew: boolean;
  informationsPane: React.ReactNode;
  tachesPane: React.ReactNode;
  conversationsPane: React.ReactNode;
  documentsPane: React.ReactNode;
  documentsCount: number;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const options: SegTabOption[] = [
    { value: "informations", label: "Informations", icon: Info },
    { value: "taches", label: "Tâches", icon: CalendarDays, count: tasksCount },
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
  ];

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        {header}
        <SegTabs
          options={options}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          overlap
          iconOnly
        />

        {tab === "informations" ? informationsPane : null}
        {tab === "conversations" ? conversationsPane : null}
        {tab === "taches" ? tachesPane : null}
        {tab === "documents" ? documentsPane : null}
      </main>
    </>
  );
}
