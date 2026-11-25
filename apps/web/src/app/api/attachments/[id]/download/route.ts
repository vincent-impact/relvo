import { NextResponse } from "next/server";
import { pageDeRefus } from "@/server/pieces";
import {
  resolveAttachmentFile,
  signDownloadUrl,
  signedRedirectHeaders,
  statutDuRefus,
  type Disposition,
} from "@/server/storage-access";

// Lecture d'une pièce jointe de message (M4.4).
// Même contrat que /api/documents/[id]/download — voir ce fichier pour le
// raisonnement complet (URL stable, redirection vs streaming, `?inline=1`).
//
// C'est ici que `?inline=1` sert le plus : une photo reçue par WhatsApp
// s'affiche dans le fil de conversation via `<img src>`.
//
// Une pièce gardée en RÉFÉRENCE (M25.3) se complète à cet appel : la route
// attend l'agrégateur, stocke, puis redirige. D'où la durée laissée à la
// fonction — une vidéo de plusieurs dizaines de méga-octets se relit en
// quelques secondes, pas en quelques millisecondes.

export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveAttachmentFile(id);

  if (!resolved.ok) {
    // Une pièce gardée en référence (M25.3) qu'on n'a pas pu aller chercher
    // répond 410, 413 ou 502 : l'écran sait le dire (`lib/pieces.ts`), et un
    // onglet du navigateur reçoit une page qui le dit aussi.
    const page = pageDeRefus(resolved, request);
    if (page) return page;
    return NextResponse.json(
      { error: "Pièce jointe introuvable." },
      { status: statutDuRefus(resolved.error) },
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
