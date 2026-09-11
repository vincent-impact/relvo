import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NewContactForm } from "@/components/contacts/new-contact-form";

export const metadata: Metadata = { title: "Nouveau contact — Relvo" };

// Création manuelle d'un contact (M9.22) — formulaire aux mêmes champs que la
// fiche. Accessible via le bouton + du hero de l'annuaire /contacts, ou via
// l'avatar « ? » d'une conversation inconnue (pré-remplit email/téléphone).
export default async function NouveauContactPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; phone?: string }>;
}) {
  const { email, phone } = await searchParams;
  return (
    <Screen>
      <RelvoHeader
        back="/contacts"
        title="Nouveau contact"
        subtitle="Renseignez les coordonnées"
        className="pb-9"
      />
      <NewContactForm initial={{ email, phone }} />
    </Screen>
  );
}
