"use server";

import { revalidatePath } from "next/cache";
import { type Annulation, defaireGeste } from "@relvo/db";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions de l'ÉCHANGE avec Relvo (M10.10) : défaire un geste depuis
// son bloc dans le fil. La logique vit dans le domaine (`defaireGeste`) ; ici
// la session, et le cache à invalider — le geste défait change l'accueil, le
// Calendrier, les affaires.

export async function annulerGesteAction(annulation: Annulation) {
  const result = await domainAction((db) => defaireGeste(db, annulation));
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/fil");
    revalidatePath("/calendrier");
    revalidatePath("/memoire");
    revalidatePath("/sujets/[id]", "page");
    revalidateTenantData();
  }
  return result;
}
