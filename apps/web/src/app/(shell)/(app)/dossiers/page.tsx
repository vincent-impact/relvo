import { redirect } from "next/navigation";

// La page « Mémoire » a disparu de la nav (2026-07-28) : la liste des domaines
// est devenue l'onglet « Domaines » des Réglages, « Contacts » ayant pris sa
// place dans la barre d'onglets basse. L'index `/dossiers` (liens résiduels,
// revalidations) renvoie donc vers cet onglet. Les fiches `/dossiers/[id]` et la
// création `/dossiers/nouveau` restent des routes à part entière.
export default function DossiersIndexPage() {
  redirect("/parametres?tab=domaines");
}
