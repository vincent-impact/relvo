import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { getTenantDb } from "@/server/auth-context";

// Fiche Contact (refonte 2026-07-28 v2) — représentation « classique » (carnet
// téléphone/WhatsApp) : TOUS les champs visibles (Entreprise · Téléphone(s) ·
// Email(s)), édition en place, actions « Modifier » / « Supprimer » dans le dock
// violet (le corps + le dock sont rendus par le client `ContactDetail`, qui
// possède son propre <Screen> — cf. le détail d'une conversation). Page PUREMENT
// INFORMATIVE (pas de fil des échanges : la conversation vit dans la fiche Sujet,
// invariant n°11).

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getTenantDb();

  const contact = await db.contact.findFirst({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      email: true,
      phone: true,
      additionalEmails: true,
      additionalPhones: true,
      status: true,
    },
  });
  if (!contact) notFound();

  return <ContactDetail contact={contact} />;
}
