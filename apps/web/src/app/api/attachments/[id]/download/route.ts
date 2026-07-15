import { NextResponse } from "next/server";
import {
  resolveAttachmentFile,
  signDownloadUrl,
} from "@/server/storage-access";

// Download d'une pièce jointe de message (M4.4).
// Même contrat que /api/documents/[id]/download — voir ce fichier pour le
// raisonnement (résolution tenant-safe, redirection 307, no-store).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveAttachmentFile(id);

  if (!resolved.ok) {
    const status = resolved.error === "unauthenticated" ? 401 : 404;
    return NextResponse.json(
      { error: "Pièce jointe introuvable." },
      { status },
    );
  }

  return NextResponse.redirect(await signDownloadUrl(resolved.file), {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
