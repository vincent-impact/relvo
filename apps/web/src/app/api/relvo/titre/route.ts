import { NextResponse } from "next/server";
import { z } from "zod";
import { logAiSolicitation, tenantDb } from "@relvo/db";
import { getCurrentAccountId } from "@/server/auth-context";
import { inferenceDisponible } from "@/server/ia";
import { titrerEchange } from "@/server/ia/echange/titre";

// Le titre d'un échange (M10.4) — appelé par l'appareil à la fin du premier
// tour. Session vérifiée ici (`/api` est hors du proxy, #30). Un échec rend
// `titre: null` : l'appareil garde son titre de repli, rien ne casse.

const Corps = z.object({
  question: z.string().min(1).max(4_000),
  reponse: z.string().min(1).max(4_000),
});

export async function POST(request: Request) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const corps = Corps.safeParse(await request.json().catch(() => null));
  if (!corps.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!inferenceDisponible()) return NextResponse.json({ titre: null });
  try {
    const { titre, mesure } = await titrerEchange({
      ...corps.data,
      cacheCle: accountId,
    });
    await logAiSolicitation(tenantDb(accountId), mesure);
    return NextResponse.json({ titre });
  } catch (err) {
    console.warn("[ia] titre-echange", err);
    return NextResponse.json({ titre: null });
  }
}
