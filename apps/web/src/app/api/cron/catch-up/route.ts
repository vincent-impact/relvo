import { NextResponse } from "next/server";
import { lancerLectureDesGroupes } from "@/server/ia/pipeline/groupes-du-jour";
import { rattraperLesCanauxDus } from "@/server/ia/pipeline/rattrapage";
import { completerLesPiecesPortees } from "@/server/medias";

// Le cron DE LA MI-JOURNÉE — `0 11 * * *` UTC (midi en hiver, 13 h en été,
// heure de Paris), déclenché par Vercel Cron (cf. vercel.json). Deux crons au
// plus sur le plan : celui-ci porte ce qui se fait une fois par jour sans
// tenir au matin.
//
//   1. La lecture des groupes (M29.5) — la seconde du jour, la première part
//      du cron du matin : ce cron ne fait que la LANCER, elle tourne dans sa
//      propre fonction (`/api/groupes/lecture`).
//   2. Le FILET du rattrapage du courrier récent (M7.19). Le rattrapage part
//      dès la connexion, par tranches enchaînées ; le cron ne fait rien dans
//      le cas normal. Il reprend une ligne restée ouverte (une tranche est
//      morte sans relancer la suivante) et continue, en lot et à moitié prix,
//      une ligne arrêtée au garde-fou en direct — sous le budget de temps de
//      la fonction, dans la limite des passages permis (un par jour ; le
//      domaine les compte en « nuits », du temps où ce cron tournait la nuit).
//   3. Le FILET des pièces qu'un sujet porte (M25.5), comme au matin : celles
//      qui sont encore des références se complètent chez l'agrégateur.
//
// Appelable à la main avec le même secret :
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/catch-up

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Ce que le filet des pièces peut prendre, avant le rattrapage. */
const BUDGET_PIECES_MS = 30_000;
/** Marge sous la durée maximale de la fonction : le dernier appel au modèle doit finir. */
const BUDGET_MS = (maxDuration - 40) * 1000 - BUDGET_PIECES_MS;

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

  const groupes = await lancerLectureDesGroupes();
  console.info("[cron] mi-journée — lecture des groupes lancée", groupes);

  const pieces = await completerLesPiecesPortees({
    budgetMs: BUDGET_PIECES_MS,
  });
  console.info("[cron] mi-journée — pièces complétées", pieces);

  const bilans = await rattraperLesCanauxDus(BUDGET_MS);
  // La sonde : un rattrapage qui finit en « erreur » plusieurs nuits de suite
  // ne se clôt jamais seul — c'est ce qu'il faut regarder ici.
  console.info("[cron] catch-up", bilans);
  return NextResponse.json({ groupes, pieces, rattrapages: bilans });
}
