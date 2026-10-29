import { notFound } from "next/navigation";
import { canalPrioritaireDuContact } from "@relvo/db";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { getTenantDb } from "@/server/auth-context";

// Fiche Contact — la carte de visite dans le ciel (portrait, nom, rôle), la
// note de Relvo sur l'interlocuteur, puis TOUS les champs (Prénom · Nom ·
// Entreprise · Téléphone(s) · Email(s)) ; édition en place par le crayon du
// ciel (le corps est rendu par le client `ContactDetail`, qui possède son
// propre <Screen>). Page PUREMENT INFORMATIVE (pas de fil des échanges : la
// conversation vit dans la fiche Sujet, invariant n°11).

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Retour → l'origine (conversation, liste) si fournie ; sinon l'annuaire.
  // Sanitisé : chemin interne uniquement.
  const backHref =
    from && from.startsWith("/") && !from.startsWith("//") ? from : "/contacts";
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
      jobTitle: true,
      role: true,
      relvoNote: true,
    },
  });
  if (!contact) notFound();
  // Le canal par lequel il nous joint (M24.8) : déduit du dernier message reçu.
  const joint = await canalPrioritaireDuContact(db, contact.id);

  return <ContactDetail contact={contact} backHref={backHref} joint={joint} />;
}
