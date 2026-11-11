import { repondreApercu } from "@/server/pieces";
import { resolveKnowledgeFile } from "@/server/storage-access";

// L'aperçu d'une connaissance (recette R18) : même contrat que celui d'une pièce jointe.
// Le raisonnement vit dans `server/pieces.ts`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return repondreApercu(await resolveKnowledgeFile(id));
}
