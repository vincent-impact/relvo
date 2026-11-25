import { after, NextResponse } from "next/server";
import {
  lancerLectureDesGroupes,
  lireLesGroupesDus,
} from "@/server/ia/pipeline/groupes-du-jour";
import { passeSuivante } from "@/server/ia/pipeline/messagerie-regles";
import { completerLesPiecesPortees } from "@/server/medias";

// UNE PASSE de la lecture des groupes (M29.5). Lancée par les deux crons du
// plan — le matin et la mi-journée —, puis par elle-même tant qu'il reste des
// groupes à lire. Elle répond 202 AUSSITÔT et travaille après sa réponse, sous
// la durée maximale de la fonction : l'appelant n'attend que l'accusé.
//
// Hors du proxy, comme toute route `/api` (PITFALLS #30) : le secret du cron
// est vérifié ici, en première ligne (#13). Appelable à la main, pour lire les
// groupes sans attendre le cron :
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/groupes/lecture

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Sous la durée maximale de la fonction ; la marge de fin de lecture est dans la configuration. */
const BUDGET_MS = (maxDuration - 10) * 1000;

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
    passe?: unknown;
  } | null;
  const passe =
    typeof corps?.passe === "number" && corps.passe >= 1 ? corps.passe : 1;
  const debut = Date.now();

  after(async () => {
    const bilan = await lireLesGroupesDus({ debut, budgetMs: BUDGET_MS });
    // La sonde : des « restants » passe après passe, ou des échecs en série,
    // se lisent ici.
    console.info("[ia] lecture des groupes", { passe, ...bilan });
    const suivante = passeSuivante(bilan, passe);
    if (suivante) await lancerLectureDesGroupes(suivante);
    // Un sujet né d'une lecture porte ses messages : leurs pièces gardées en
    // référence se complètent (M25.5), dans ce qu'il reste de la fonction.
    const reste = BUDGET_MS - (Date.now() - debut);
    if (reste > 20_000) {
      const pieces = await completerLesPiecesPortees({
        budgetMs: Math.min(reste - 10_000, 60_000),
      });
      console.info("[ia] lecture des groupes — pièces complétées", pieces);
    }
  });
  return NextResponse.json({ ok: true, passe }, { status: 202 });
}
