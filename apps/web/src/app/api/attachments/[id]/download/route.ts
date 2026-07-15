import { NextResponse } from "next/server";
import {
  resolveAttachmentFile,
  signDownloadUrl,
  signedRedirectHeaders,
  type Disposition,
} from "@/server/storage-access";

// Lecture d'une pièce jointe de message (M4.4).
// Même contrat que /api/documents/[id]/download — voir ce fichier pour le
// raisonnement complet (URL stable, redirection vs streaming, `?inline=1`).
//
// C'est ici que `?inline=1` sert le plus : une photo reçue par WhatsApp
// s'affiche dans le fil de conversation via `<img src>`.

export async function GET(
  request: Request,
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

  const disposition: Disposition = new URL(request.url).searchParams.has(
    "inline",
  )
    ? "inline"
    : "attachment";

  return NextResponse.redirect(
    await signDownloadUrl(resolved.file, disposition),
    { status: 307, headers: signedRedirectHeaders() },
  );
}
