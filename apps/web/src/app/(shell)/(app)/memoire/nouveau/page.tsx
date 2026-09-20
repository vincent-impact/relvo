import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NewFolderForm } from "@/components/memoire/new-folder-form";

export const metadata: Metadata = { title: "Nouveau domaine — Relvo" };

// Création d'un domaine de la Mémoire (M9.20) — nom + logo (couleur + icône).
// Accessible via le « + » de la page Mémoire (/memoire).
export default function NouveauDomainePage() {
  return (
    <Screen>
      <RelvoHeader
        back="/memoire"
        title="Nouveau domaine"
        subtitle="Nom et logo du domaine"
        className="pb-9"
      />
      <NewFolderForm />
    </Screen>
  );
}
