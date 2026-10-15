import { NextResponse } from "next/server";
import { validateUIMessages } from "ai";
import { z } from "zod";
import { getCurrentAccountId } from "@/server/auth-context";
import { repondreAuTour, type RelvoUIMessage } from "@/server/ia/echange";

// La route de l'échange avec Relvo (M10.7) — un tour par requête, en flux.
//
// ⚠️ `/api` est hors du proxy (PITFALLS.md #30) : la session se vérifie ICI,
// et un anonyme reçoit 401, jamais une redirection — l'appelant est un fetch.
// L'identifiant du compte vient de la session, jamais du corps (invariant 1).
// Le corps est ce que le transport du SDK envoie : les messages de
// l'interface, plus la page d'origine et le drapeau de discussion générale.

export const maxDuration = 60;

const Corps = z.object({
  messages: z.array(z.unknown()).min(1).max(200),
  from: z.string().max(500).nullable().optional(),
  general: z.boolean().optional(),
});

export async function POST(request: Request) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }
  const corps = Corps.safeParse(raw);
  if (!corps.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  let messages: RelvoUIMessage[];
  try {
    messages = await validateUIMessages<RelvoUIMessage>({
      messages: corps.data.messages,
    });
  } catch {
    return NextResponse.json({ error: "Messages invalides." }, { status: 400 });
  }

  return repondreAuTour({
    accountId,
    messages,
    from: corps.data.from ?? null,
    general: corps.data.general ?? false,
  });
}
