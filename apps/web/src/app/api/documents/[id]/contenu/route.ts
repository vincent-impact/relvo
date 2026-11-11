import { repondreContenu } from "@/server/pieces";
import { resolveKnowledgeFile } from "@/server/storage-access";

// Les octets d'une connaissance, pour « Ouvrir avec… » (recette R18) — plafonnés.
// Le raisonnement vit dans `server/pieces.ts`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return repondreContenu(await resolveKnowledgeFile(id));
}
