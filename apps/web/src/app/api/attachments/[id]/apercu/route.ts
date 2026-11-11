import { repondreApercu } from "@/server/pieces";
import { resolveAttachmentFile } from "@/server/storage-access";

// L'aperçu d'une pièce jointe (recette R18) : son nom, son poids, et le tableau d'un classeur.
// Le raisonnement vit dans `server/pieces.ts`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return repondreApercu(await resolveAttachmentFile(id));
}
