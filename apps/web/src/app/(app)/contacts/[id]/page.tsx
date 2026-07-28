import { notFound } from "next/navigation";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ContactCard } from "@/components/contacts/contact-card";
import { ContactDeleteButton } from "@/components/contacts/contact-delete-button";
import { contactFullName } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Fiche Contact (refonte 2026-07-28) — représentation « classique » (carnet
// téléphone/WhatsApp) : Prénom · Nom · Entreprise · Téléphone(s) · Email(s), avec
// plusieurs numéros/adresses possibles. Page PUREMENT INFORMATIVE (pas de fil des
// échanges ici : la conversation vit dans la fiche Sujet, invariant n°11).

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
        subtitle={contact.company || "Contact"}
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
