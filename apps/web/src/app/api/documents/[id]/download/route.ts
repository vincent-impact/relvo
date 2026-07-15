import { NextResponse } from "next/server";
import { resolveKnowledgeFile, signDownloadUrl } from "@/server/storage-access";

// Download d'un document de Connaissances (M4.4).
//
// Le client passe l'ID du DOCUMENT, pas la clé de stockage : celle-ci est
// résolue depuis la base scopée par tenant (cf. storage-access.ts).
//
// On redirige vers une URL pré-signée courte plutôt que de streamer le fichier
// à travers la Function : le body de réponse est lui aussi plafonné à 4,5 Mo, et
// faire transiter les octets nous coûterait du Fast Data Transfer pour rien.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveKnowledgeFile(id);

  if (!resolved.ok) {
    // 404 sur `unauthenticated` comme sur `not_found` : distinguer les deux
    // révélerait l'existence d'un document d'un autre compte.
    const status = resolved.error === "unauthenticated" ? 401 : 404;
    return NextResponse.json({ error: "Document introuvable." }, { status });
  }

  return NextResponse.redirect(await signDownloadUrl(resolved.file), {
    // 307 : la redirection est valable pour cette requête uniquement. Un 301/302
    // serait mis en cache par le navigateur et pointerait vers une URL expirée.
    status: 307,
    headers: {
      // L'URL signée ne doit jamais être mémorisée par un cache intermédiaire.
      "Cache-Control": "private, no-store",
    },
  });
}
