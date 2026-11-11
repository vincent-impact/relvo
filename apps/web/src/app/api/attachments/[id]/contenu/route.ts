import { repondreContenu } from "@/server/pieces";
import { resolveAttachmentFile } from "@/server/storage-access";

// Les octets d'une pièce jointe, pour « Ouvrir avec… » (recette R18) — plafonnés.
// Le raisonnement vit dans `server/pieces.ts`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return repondreContenu(await resolveAttachmentFile(id));
}
