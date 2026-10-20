import { after, NextResponse } from "next/server";
import { executerTranche, trouverLigne } from "@/server/ia/pipeline/rattrapage";

// UNE TRANCHE du rattrapage du courrier récent (M7.19). Appelée par le
// webhook de fin de connexion (la première), par la tranche précédente (les
// suivantes), ou par une page qui voit une ligne en panne. Elle répond 202
// AUSSITÔT et travaille après sa réponse, sous la durée maximale de la
// fonction : l'appelant n'attend que l'accusé, jamais le travail.
//
// Hors du proxy, comme toute route `/api` (PITFALLS #30) : le secret du cron
// est vérifié ici, en première ligne (#13). Appelable à la main :
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//        -H "content-type: application/json" -d '{"catchupId":"…"}' \
//        https://<app>/api/rattrapage/tranche

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Marge sous la durée maximale de la fonction : le dernier appel au modèle doit finir. */
const BUDGET_MS = (maxDuration - 40) * 1000;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const corps = (await request.json().catch(() => null)) as {
    catchupId?: unknown;
  } | null;
  const catchupId =
    typeof corps?.catchupId === "string" ? corps.catchupId : null;
  if (!catchupId) {
    return NextResponse.json({ error: "catchupId requis." }, { status: 400 });
  }
  const ligne = await trouverLigne(catchupId);
  if (!ligne) {
    return NextResponse.json({ ok: true, ignored: "ligne-close" });
  }

  after(async () => {
    const bilan = await executerTranche(ligne, {
      debut: Date.now(),
      budgetMs: BUDGET_MS,
    });
    // La sonde : une ligne qui finit en « erreur » tranche après tranche ne
    // se clôt jamais seule — c'est ce qu'il faut regarder ici.
    console.info("[ia] tranche", bilan);
  });
  return NextResponse.json({ ok: true, catchupId }, { status: 202 });
}
