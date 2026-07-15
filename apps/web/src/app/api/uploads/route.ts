import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAccountId } from "@/server/auth-context";
import {
  buildObjectKey,
  buildUploadRequestSchema,
  getStorage,
  type StorageScope,
} from "@relvo/storage";

// Émission d'une URL d'upload pré-signée (M4.3).
//
// Le navigateur envoie ensuite le fichier DIRECTEMENT au stockage, sans repasser
// par nous : une Vercel Function plafonne le body à 4,5 Mo (non configurable) et
// une Server Action à 1 Mo — un PDF de Connaissances dépasse couramment.
//
// C'est donc le SEUL point de contrôle avant écriture dans le bucket. Le type
// validé ici est signé dans l'URL (cf. r2.ts), ce qui le rend contraignant.

const SCOPES = ["knowledge", "attachments"] as const;

export async function POST(request: Request) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    // 401 et non un redirect : l'appelant est un fetch, pas une navigation.
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  // Le scope détermine le schéma : les Connaissances n'acceptent ni vidéo ni
  // tableur, et les plafonds de taille diffèrent.
  const scope = z.object({ scope: z.enum(SCOPES) }).safeParse(raw);
  if (!scope.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = buildUploadRequestSchema(scope.data.scope).safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Fichier refusé.",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 422 },
    );
  }

  // La clé est construite à partir de l'account_id de la SESSION — jamais d'une
  // valeur envoyée par le client.
  const key = buildObjectKey({
    accountId,
    scope: scope.data.scope satisfies StorageScope,
  });

  const upload = await getStorage().presignUpload({
    key,
    contentType: parsed.data.contentType,
    contentLength: parsed.data.contentLength,
  });

  return NextResponse.json({
    url: upload.url,
    key: upload.key,
    requiredHeaders: upload.requiredHeaders,
    expiresAt: upload.expiresAt.toISOString(),
  });
}
