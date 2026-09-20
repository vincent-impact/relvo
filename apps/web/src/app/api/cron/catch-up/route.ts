import { NextResponse } from "next/server";
import { rattraperLesCanauxDus } from "@/server/ia/pipeline/rattrapage";

// Le rattrapage du courrier récent (M7.19), la nuit.
//
// Déclenché par Vercel Cron (cf. vercel.json), une fois par nuit. Reprend
// chaque rattrapage demandé à la connexion d'un canal e-mail et non encore
// clos : import du courrier de la fenêtre, tri en lot, sous le budget de temps
// de la fonction ; ce qui n'a pas eu son tour reprend la nuit suivante, dans
// la limite des nuits permises. Appelable à la main avec le même secret pour
// ne pas attendre la nuit :
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/catch-up

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Marge sous la durée maximale de la fonction : le dernier appel au modèle doit finir. */
const BUDGET_MS = (maxDuration - 40) * 1000;

export async function GET(request: Request) {
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

  const bilans = await rattraperLesCanauxDus(BUDGET_MS);
  // La sonde : un rattrapage qui finit en « erreur » plusieurs nuits de suite
  // ne se clôt jamais seul — c'est ce qu'il faut regarder ici.
  console.info("[cron] catch-up", bilans);
  return NextResponse.json({ rattrapages: bilans });
}
