import { notFound } from "next/navigation";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ContactCard } from "@/components/contacts/contact-card";
import { ContactDeleteButton } from "@/components/contacts/contact-delete-button";
import { contactFullName } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Contact (M9.11, Direction B) — page PUREMENT INFORMATIVE : coordonnées
// (prénom, nom, téléphone, email) + suppression. Pas de fil des échanges ici
// (la conversation vit dans la fiche Sujet, invariant n°11) — la fiche contact
// reste volontairement minimale.

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const contact = await db.contact.findFirst({ where: { id } });
  if (!contact) notFound();

  return (
    <Screen>
      <RelvoHeader
        back="/contacts"
        title={contactFullName(contact)}
        subtitle={
          [contact.jobTitle, contact.company].filter(Boolean).join(" · ") ||
          "Contact"
        }
        className="pb-9"
      />

      <ContactCard contact={contact} />

      <ContactDeleteButton
        contactId={contact.id}
        contactName={contactFullName(contact)}
      />
    </Screen>
  );
}
