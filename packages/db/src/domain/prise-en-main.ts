import type { Sector } from "../generated/prisma/enums";

// LES DOMAINES TYPIQUES D'UN SECTEUR (M17.10, 05 §9.6, 04 §10) : ce que Relvo
// propose à cocher pendant la prise en main, quand le compte n'a encore que
// Général. C'est une DONNÉE DE CRÉATION — un nom, une description d'une ligne,
// un logo —, jamais une consigne au modèle : les domaines émergent du courrier,
// cette liste ne fait qu'épargner au dirigeant un formulaire vide. Les clés
// de couleur et d'icône sont celles du registre curé de l'application
// (`lib/folders.ts`) ; une clé inconnue retombe sur le repli, sans casser.

export type DomaineTypique = {
  /** La clé de la réponse — et le slug du domaine créé. */
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string;
};

export const DOMAINES_TYPIQUES: Record<Sector, readonly DomaineTypique[]> = {
  food: [
    {
      key: "fournisseurs",
      name: "Fournisseurs",
      description: "Commandes, livraisons, ruptures, tarifs",
      color: "amber",
      icon: "boxes",
    },
    {
      key: "equipe",
      name: "Équipe",
      description: "Recrutement, plannings, absences, contrats",
      color: "green",
      icon: "users",
    },
    {
      key: "materiel",
      name: "Matériel",
      description: "Pannes, maintenance, froid, cuisson",
      color: "teal",
      icon: "wrench",
    },
    {
      key: "clients",
      name: "Clients",
      description: "Commandes, réclamations, événements, traiteur",
      color: "red",
      icon: "utensils",
    },
    {
      key: "administratif",
      name: "Administratif",
      description: "Comptable, banque, assurance, administration",
      color: "blue",
      icon: "scale",
    },
  ],
  construction: [
    {
      key: "chantiers",
      name: "Chantiers",
      description: "Suivi des travaux, plannings, réceptions",
      color: "amber",
      icon: "building",
    },
    {
      key: "devis",
      name: "Devis",
      description: "Demandes, chiffrages, relances, signatures",
      color: "purple",
      icon: "banknote",
    },
    {
      key: "fournisseurs",
      name: "Fournisseurs",
      description: "Matériaux, livraisons, tarifs, sous-traitants",
      color: "teal",
      icon: "truck",
    },
    {
      key: "equipe",
      name: "Équipe",
      description: "Recrutement, plannings, absences, intérim",
      color: "green",
      icon: "users",
    },
    {
      key: "administratif",
      name: "Administratif",
      description: "Comptable, banque, assurance, qualifications",
      color: "blue",
      icon: "scale",
    },
  ],
  // « Un autre métier » : les domaines qu'on retrouve dans la plupart des
  // entreprises, sans mot d'un secteur — le métier dit par le dirigeant, lui,
  // vit dans une instruction du compte.
  other: [
    {
      key: "clients",
      name: "Clients",
      description: "Demandes, commandes, réclamations, suivi",
      color: "red",
      icon: "building",
    },
    {
      key: "fournisseurs",
      name: "Fournisseurs",
      description: "Commandes, livraisons, tarifs, prestataires",
      color: "amber",
      icon: "boxes",
    },
    {
      key: "devis",
      name: "Devis",
      description: "Demandes, chiffrages, relances, signatures",
      color: "purple",
      icon: "banknote",
    },
    {
      key: "equipe",
      name: "Équipe",
      description: "Recrutement, plannings, absences, contrats",
      color: "green",
      icon: "users",
    },
    {
      key: "administratif",
      name: "Administratif",
      description: "Comptable, banque, assurance, administration",
      color: "blue",
      icon: "scale",
    },
  ],
};

/**
 * Les domaines typiques des secteurs d'un compte, sans doublon de clé — un
 * nom partagé par deux secteurs n'est proposé qu'une fois, avec la description
 * du premier secteur dans l'ordre canonique. Les domaines de tout métier
 * (`other`) ne viennent qu'en l'absence de secteur connu : un métier connu a
 * déjà les siens.
 */
export function domainesTypiquesDe(
  sectors: readonly Sector[],
): DomaineTypique[] {
  const vus = new Set<string>();
  const out: DomaineTypique[] = [];
  const connus = (["food", "construction"] as const).filter((s) =>
    sectors.includes(s),
  );
  const ordre: readonly Sector[] =
    connus.length > 0 ? connus : sectors.includes("other") ? ["other"] : [];
  for (const s of ordre) {
    for (const d of DOMAINES_TYPIQUES[s]) {
      if (vus.has(d.key)) continue;
      vus.add(d.key);
      out.push(d);
    }
  }
  return out;
}
