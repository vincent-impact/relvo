import { NextResponse } from "next/server";
import {
  resolveKnowledgeFile,
  signDownloadUrl,
  signedRedirectHeaders,
  type Disposition,
} from "@/server/storage-access";

// Lecture d'un document de Connaissances (M4.4).
//
// L'URL est STABLE et permanente : `/api/documents/<id>/download`. C'est elle
// que les composants manipulent — dans un `<img src>`, un `<iframe>`, un `<a>`.
// L'URL signée de 5 min est fabriquée au dernier moment et jamais exposée.
//
// C'est l'architecture par défaut d'ActiveStorage (URL de contrôleur permanente
// → 302 vers une URL de service courte), à une différence près : celle de Rails
// n'est PAS authentifiée (« Anyone who knows the URL can access the file, even
// if the rest of your application requires authentication »), la nôtre l'est.
// C'est ce que Rails appelle un « Authenticated Controller », et ce qu'il
// recommande dès que les fichiers sont sensibles — ce qui est le cas de TOUS les
// nôtres (factures, contrats, photos de chantier).
//
// On REDIRIGE, on ne streame pas : Vercel est explicite — « Vercel Functions […]
// should be treated like a lightweight API layer, not a media server ». Et le
// body d'une réponse de Function plafonne à 4,5 Mo.
//
// `?inline=1` → affichage dans la page. Défaut → téléchargement sous le vrai nom
// du fichier (la clé est aléatoire, sinon il atterrirait nommé comme un UUID).

export async function GET(
  request: Request,
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

  const disposition: Disposition = new URL(request.url).searchParams.has(
    "inline",
  )
    ? "inline"
    : "attachment";

  return NextResponse.redirect(
    await signDownloadUrl(resolved.file, disposition),
    {
      // 307 : la redirection vaut pour cette requête. Un 301/302 serait mémorisé
      // par le navigateur et pointerait vers une URL signée expirée.
      status: 307,
      headers: signedRedirectHeaders(),
    },
  );
}
