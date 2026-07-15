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
// C'est donc le SEUL point de contrôle avant écriture dans le bucket : après
// émission de l'URL, plus rien ne s'interpose. D'où la validation stricte, et
// le fait que type et poids soient signés dans l'URL (cf. r2.ts) : une URL
// obtenue pour un PDF de 1 Mo ne peut pas servir à pousser autre chose.

const SCOPES = ["knowledge", "attachments"] as const;

const bodySchema = z.object({
  scope: z.enum(SCOPES),
  filename: z.string(),
  contentType: z.string(),
  contentLength: z.number(),
});

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

  const envelope = bodySchema.safeParse(raw);
  if (!envelope.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Le schéma dépend du scope : les Connaissances n'acceptent ni vidéo ni
  // tableur, et les plafonds de taille diffèrent.
  const scope: StorageScope = envelope.data.scope;
  const parsed = buildUploadRequestSchema(scope).safeParse(envelope.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Fichier refusé.",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 422 },
    );
  }

  // La clé est construite ici, à partir de l'account_id de la SESSION — jamais
  // d'une valeur envoyée par le client.
  const key = buildObjectKey({
    accountId,
    scope,
    filename: parsed.data.filename,
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
